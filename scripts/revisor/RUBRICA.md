# LA RÚBRICA DEL REVISOR — lo que se verifica antes de que un expediente salga a una planta

> Orden 2026-10-24-e-el-revisor. La usa el revisor automático (subagente Fable que lanza la skill `revisor-forja`).
> Sale del debate de 25 expertos y sus 3 jueces (`Downloads/la-pelicula/debate-25-expertos/00-PLAN.md`, `jueces/`).
> Cada renglón cita de dónde viene. Lo que no tiene cita es **regla de Hefestos** y lo dice.

## Qué eres y qué no

Eres el **control de calidad** del expediente: nada sale a una planta sin tu revisión. **No apruebas la fabricación**: eso lo
firma el fabricante del molde (decisión de ian, 2026-10-24). Tu trabajo es detectar lo que un ingeniero de la planta
desmentiría en 10 minutos, lo que acusa legalmente, y lo que la pantalla dice pero no se ve.

## Lo que recibes (el paquete, carpeta `<folio>/`)

| Archivo | Qué es |
|---|---|
| `indice.json` | la lista de stills en orden, qué mirar en cada uno, los gestos y errores de la corrida |
| `stills/s01…s09-*.jpg` | lo que el cliente ve, paso por paso, a 3840×2160 (la app real, build de producción) |
| `textos/<paso>.txt` | el texto VISIBLE de cada paso (opacidad > 0, dentro del cuadro); `04` trae además el dictamen completo y `04-dictamen-filas.txt` el detalle de cada fila ✗ (con su número) |
| `textos/laminas.txt` | el texto de TODAS las láminas del juego de planos (cajetín incluido) |
| `textos/expediente.txt` + `expediente.html` | el archivo EXACTO que el botón «Descargar» le da al cliente (y su versión en texto) |
| `numeros.json` | los números que la máquina midió (`__forgeBrep`): pared, pines, tramos de agua, soporte, carrera, Foco, recorrido; y `dondeAparece` (en qué pasos sale cada número) |
| `hallazgos-texto.json` | un detector mecánico de los apagones: DÓNDE aparece cada patrón (con contexto). Señala; **tú confirmas con el still** |
| `folio.json` | sesión · commit · SHA-256 del STEP; si el commit está verificado; el intake que declaró el cliente |
| `intake.json` (si hay) | lo que el cliente declaró: material, volumen, máquina |

## Cómo se revisa

1. Abre **TODOS** los stills con Read, en el orden de `indice.json`. No juzgues un paso sin haber visto su still.
2. Lee `textos/*.txt`, `numeros.json`, `hallazgos-texto.json` y `folio.json`. El texto te dice QUÉ dice la pantalla; el still te
   dice si se VE. Si el detector señala algo, búscalo en el still o en el texto y confírmalo o descártalo (di por qué).
3. Marca cada renglón de abajo con una sola marca:
   - **◆ detiene**: el expediente NO sale así.
   - **◇ con nota**: sale, con la nota escrita para el cliente.
   - **✓**: revisado y bien.
   - **— no aplica**: con la razón (ej. «la pieza no tiene contrasalidas»).
4. Cada marca lleva **evidencia**: un still (`stills/s07-punto-3.jpg`: lo que se ve), un texto citado entre comillas con su archivo
   (`textos/expediente.txt`: «…»), o un número de `numeros.json` (campo y valor). Una marca sin evidencia no vale.
5. **Lo que no pudiste revisar se dice**: si falta el still o el texto de un renglón ◆, ese renglón es ◆ «sin evidencia» (no se
   entrega lo que no se revisó). Si es de los ◇, queda ◇ «no revisado».
6. **La imagen-control**: entre los stills hay al menos uno de CONTROL con un defecto sembrado (un defecto que la app real ya
   tuvo). No sabes cuál. Juzga cada still igual que los demás. Si apruebas el de control, tu revisión se tira y se repite.

### El veredicto (mecánico, sin excepciones)

- Algún ◆ → **SE DETIENE**
- Ningún ◆ y algún ◇ → **SE ENTREGA CON NOTAS**
- Todo ✓ o — → **SE ENTREGA**

---

## A · EL PAPEL: folio, borrador, firmas y cajetín

| id | Se verifica | ◆ si… | ◇ si… | Fuente |
|---|---|---|---|---|
| A1 | **Folio** = sesión · commit · SHA-256 del STEP, en `folio.json` **e impreso en el expediente** | el expediente no lleva folio impreso | el commit está «NO VERIFICADO» en `folio.json` | 00-PLAN acuerdo 6; abogado r2 «folio antes que hash solo»; juez A sem 3 |
| A2 | **BORRADOR / PROPUESTA** mientras haya firmas pendientes, en el expediente y en las láminas | hay decisiones «pendientes de firma» y el expediente o las láminas NO dicen BORRADOR/PROPUESTA | la marca existe pero no se lee a 4K | juez B D4: «sale siempre, con marca de agua PROPUESTA · BORRADOR hasta que cada decisión §13.10 tenga nombre, rol y fecha» |
| A3 | **Nada verde junto a firmas pendientes**: un ✓ o un recuadro verde al lado de «N pendientes de firma» | aparece (still `s09`) | — | juez A §4.8 (`ForgeBRepStudio.tsx:10052`); abogado r1 «borrador con palomita» |
| A4 | **Cajetín sin literales inventados**: ISO 2768-mK, «Ra 0.8», «H7 · roscas 6H» como literal, «DIBUJÓ: La Forja CAD» | aparece cualquiera (`textos/laminas.txt`, `hallazgos-texto.json` ids `cajetin-*`) | — | 00-PLAN hallazgo 10; juez A §4.7; abogado r2: entra solo lo derivado (`fits.ts`), «tolerancia general: la fija el fabricante», REVISÓ/APROBÓ para humanos |
| A5 | **Quién responde, dicho**: «nada se fabrica sin la revisión y firma del fabricante del molde» | — | no aparece en el expediente | juez B §5 (texto literal); decisión de ian 2026-10-24 |

## B · LOS APAGONES (lo que un ingeniero desmiente en 10 minutos)

| id | Se verifica | ◆ si… | ◇ si… | Fuente |
|---|---|---|---|---|
| B1 | **Dinero en dólares o sin moneda**: «USD», «US$», «EE.UU. por defecto», banda $/pza, o una cifra con «$» que no dice su moneda ni su tarifa (`hallazgos-texto.json` ids `usd`, `dinero-sin-moneda`) | aparece una cifra en USD, una tarifa extranjera fija, o una cifra con «$» sin moneda ni tarifa (hoy por dentro es USD a 100/h: una planta la lee en pesos) | la cifra está en MXN con su tarifa pero se llama «cotización» y no «costo de referencia» | hallazgo 6 (`moldmachine.ts:185`); juez B D8; juez A D3 |
| B2 | **«puntos débiles»** como veredicto absoluto | aparece («0 puntos débiles») | — | hallazgo 12; juez A §4.1 y §5: «0 choques entre barrenos · revisé 915 pares… · no revisé…» |
| B3 | **Puntaje /100** (DFM 100/100, dictamen 70/100) | aparece en pantalla, láminas o expediente | — | juez A D2: «Se retira el puntaje»; hallazgo 11 (`agua-ciclo` cumple con cualquier ciclo) |
| B4 | **134 s como ciclo** (número único de enfriamiento por Eq 9.5 de placa sobre un poste) | aparece como titular/ciclo sin la ventana ni la forma | aparece dentro de una ventana honesta («poste 65–136 s · pared 21.7 s») sin decir la fórmula | hallazgo 3; juez C D1; juez A D4 |
| B5 | **Tonelaje sin piso**: «2.3 %», «flash ✓ · 0 pilares» | aparece | — | hallazgo 1; juez C §1.1: a 50 MPa son ≈36 t = 24 % de 150 t |
| B6 | **Material**: «PP» rotulado sobre una pieza que corre en ABS, o material ≠ el que el cliente declaró (`intake.json`) | aparece «PP» sin que la pieza sea PP, o el material de la app ≠ el declarado | el material no se dice en algún paso | hallazgo 5; juez C §1.4; juez A §4.6 |
| B7 | **«50 de 50 tocan»** | aparece | — | juez A D9: 50 rayos no certifican rasgos de ⌀8 |
| B8 | **Volumen < 5,000**: cotiza aluminio y la hoja calcula P20 | el volumen es < 5,000 y el acero del costo ≠ el de la hoja | — | juez A §4.11; juez C §4 |
| B9 | **Palabras sin acta**: «simulación de llenado», «CFD», «FEA» presentados como resultado | se presentan como análisis hecho (sin «por fórmula», «no es…») | aparecen solo como etiqueta de botón o con su aclaración | 00-PLAN acuerdo 4; abogado r2 P2 (CCF 1812-1813) |
| B10 | **Contrasalidas «juzgadas» de mentira**: «única dirección sin undercuts; el DFM ya la juzgó» cuando el DFM dijo con-mecanismos | aparece con DFM ≠ moldeable | — | juez A §4.9 (`estudio-molde-datos.ts:1664`) |
| B11 | **Inglés colado** (WARPAGE TOPOLOGIA, STEEL SAFE) en la vista del cliente | — | aparece | brief §2; juez A §5 (DP → «caída de presión», STEEL SAFE → «a prueba de acero») |
| B12 | **Ruido de taller**: «MOLD TOOLS · curso Alwis», ✗ por < 0.05 mm, 🏗 sin MPa, telemetría del kernel o notas de desarrollo | — | aparece | juez A §4.12; contrato del camino (`caminos/la-carcasa-de-mitsubishi.md`, cláusula 3) |

## C · UNA SOLA VERDAD (el mismo número en todos los pasos)

| id | Se verifica | ◆ si… | ◇ si… | Fuente |
|---|---|---|---|---|
| C1 | **El acero junto al agua** (la holgura agua↔barreno más justa, `numeros.json` `molde.foco.holguraMinMm`, hoy ≈ 3.49): el MISMO número y el MISMO veredicto en 04 (dictamen, CLARO §9.2.7), 07 (punto del agua) y 08/expediente | dos pasos dan veredictos opuestos (✗ en uno, «cumple» en otro) o |Δ| ≥ 0.01 mm | el número no aparece en algún paso | hallazgo 2; juez C D3: «Δ > 0.01 mm = rojo y no sale expediente»; juez A sem 2–3 |
| C2 | **El ciclo / enfriamiento**: el mismo número (o la misma ventana) en 03, 06, 08 y 09/expediente | dos pasos dan ciclos distintos sin explicar por qué | — | 00-PLAN sem 2 «los pasos 3, 6, 8 y 9 con el mismo par» |
| C3 | **El tonelaje**: el mismo en la hoja de análisis (08) y el expediente (09) | distinto | no aparece en uno de los dos | orden E (esta), juez C sem 1 |
| C4 | **Cavidades**: las mismas en dictamen (04), hoja (08) y expediente | distintas | — | contrato del camino cláusula 3 («una sola verdad: cavidades, ciclo, puntaje») |
| C5 | **La pared medida**: la misma en 02, 06 y el expediente (`numeros.json` `pieza.paredMm`) | — | distinta o ausente | regla de Hefestos (la pared alimenta enfriamiento, botadores y costo: si cambia entre pasos, algo se calculó con otra pieza) |
| C6 | **Lo que el cliente declaró se usó**: material, volumen y máquina de `intake.json` = los que dicen los pasos 03/08/09 | el material o la máquina usados ≠ los declarados | no hubo intake (se dice que se usaron los valores por defecto) | juez A sem 5–6 «entradas por un motor»; hallazgo 5 |

## D · LO QUE NO SE REVISÓ SE DICE (el alcance)

| id | Se verifica | ◆ si… | ◇ si… | Fuente |
|---|---|---|---|---|
| D1 | **El Foco y la inspección dicen su alcance**: cuántos pares revisó y qué NO (agua contra agua, pines contra guías, acero contra plástico) | afirma un absoluto («0 …», «sin problemas») sin decir sobre qué | da números pero no dice lo que no revisó | juez A §5 (texto literal); juez C §5 |
| D2 | **El expediente dice lo que no cubre**: contrasalidas, canal caliente, varias cavidades, llenado 3D, alabeo, esfuerzo por elemento finito, agua por CFD | — | no lo dice | juez B §5 (texto literal) |
| D3 | **El enfriamiento dice su fórmula** (Eq 9.5 placa / 9.6 cilindro) y que el ciclo real es mayor (§9.2.1) | — | no lo dice | juez C §5; juez A §5 |
| D4 | **El costo es «de referencia»**, con la tarifa del cliente, y no sale si la pieza no es moldeable | sale una cifra para una pieza con contrasalidas o «con-mecanismos» | no dice «de referencia» o no dice con qué tarifa | juez A D3; juez B D8 |

## E · LA ESCALA DEL ACERO

| id | Se verifica | ◆ si… | ◇ si… | Fuente |
|---|---|---|---|---|
| E1 | **La escala está declarada** en láminas y expediente: o la contracción aplicada con su fuente, o «Acero SIN ESCALAR (×1.000) · no maquinar» | no se dice nada de la escala (el inserto saldría chico y nadie lo sabe) | se dice pero sin quién firma la contracción (§10.1.7) | hallazgo 4 (`useMoldStudio.ts:999`); juez A §5; juez B §5 |

## F · LA PUERTA (¿se podía?)

| id | Se verifica | ◆ si… | ◇ si… | Fuente |
|---|---|---|---|---|
| F1 | **Contrasalidas detenidas**: si la pieza tiene zonas que no salen en línea recta («con-mecanismos», undercuts), el camino se detiene ANTES del molde y del precio | hubo molde o precio para una pieza con contrasalidas | — (si la pieza no tiene: — no aplica, con la evidencia de que no tiene) | hallazgo 7; juez A D7; juez C §1.8 |
| F2 | **Un solo cuerpo, o dice cuál**: un STEP de varios sólidos dice cuál moldea | moldeó un ensamble sin decirlo | — | juez A D5 y §5 («Tu archivo trae 6 sólidos: ¿cuál moldeo?») |
| F3 | **El molde es de ESTA pieza**: pines por agarre en la E7 (`numeros.json` `molde.pines.n` > 0), la pared del molde = la medida | no | — | seguro de `filma-camino.cjs` (la carrera del arranque armó el molde de otra pieza, 2026-10-23) |

## G · LOS OJOS (cada still)

| id | Se verifica | ◆ si… | ◇ si… | Fuente |
|---|---|---|---|---|
| G1 | **Lo que dice la tarjeta se ve en el 3D** (por still): el objeto del que habla está en cuadro, con luz, centrado; la cota apunta a lo que mide | la tarjeta habla de algo que no se ve (cuadro negro, lienzo vacío, molde fuera de cuadro) | se ve a medias (tapado por un panel, cortado, una cota que no apunta a su objeto) | ian: «juzga todo visualmente»; contrato del camino cláusula 2 («LO QUE HAY SE VE») |
| G2 | **Se lee**: los números que importan se leen a 4K | — | ilegibles (tamaño, contraste, encimados) | regla de Hefestos (un número que no se lee no informa) |
| G3 | **Los 18 stills existen** y son de la pieza del folio (el nombre de la pieza en pantalla = el del STEP) | falta un still de 02/04/06/07/08/09 o es de otra pieza | falta uno de 01/05 | orden E §1 (stills por paso) |

---

## Lo que escribes: `REVISION.md`

```
# REVISIÓN · <pieza> · folio <folio>
VEREDICTO: SE DETIENE | SE ENTREGA CON NOTAS | SE ENTREGA
◆ <n> · ◇ <n> · ✓ <n> · — <n>

## Por qué (3 a 6 líneas, para ian y para la planta: lo más grave primero, en lenguaje de taller)

## Renglón por renglón
| id | marca | evidencia (still / texto citado / número) | nota |
| A1 | ◆ | textos/expediente.txt: no aparece «folio» ni el SHA | … |
… (TODOS los renglones A1–G3, en orden)

## Still por still (los 18, en el orden de indice.json)
| still | qué se ve | ¿la tarjeta se ve en el 3D? | marca |
| stills/s01-abres-la-forja.jpg | … | … | ✓/◇/◆ |
…

## Notas para el cliente (solo si SE ENTREGA CON NOTAS: cada ◇ en una línea, sin siglas)

## Lo que esta revisión NO cubre
(esta revisión mira el expediente, no el acero: no verifica llenado, alabeo, esfuerzos ni que el molde funcione)
```

La firma la agrega la skill al pie (no la escribas tú).
