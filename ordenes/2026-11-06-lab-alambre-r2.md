# ORDEN K·2: el módulo del alambre, ronda 2

ESTADO: hoy, agente de fondo. ian aprobó los cambios de contrato de la ronda 1 («dale los cambios»). El contrato v2 ya está escrito: `src/forja/lab/laboratorio-contrato.ts` (`CONTRATO_RONDA = 2`, `CAMBIOS_R2`, `DECISIONES`). La ronda 1 de este módulo está en `ordenes/2026-11-05-lab-alambre.md`.

BASE: 32f3e93

OBJETIVO: el mismo módulo, puesto al día con el contrato v2 y con cero errores de su juez.
- **A.POT a z = 210** (lo pediste tú): K06 sube junto al cuello desde el portapuntas y sale por el pasamuros a z 210; se acaba el tramo que bajaba 150 mm. Con el contrato v2 tu juez hoy marca 2 errores y la prueba térmica da 73.7 °C > 70 donde el cable toca PETG: se corrigen con el diseño, no con la prueba.
- **D4:** la junta portapuntas–OUT− es de Silfos (cobre-fósforo con 15 % de plata) con soplete; el portapuntas es de latón, así que lleva fundente.
- **D5:** el carrete abajo con su arco de PTFE se queda, y el balero de la loca es 625-ZZ.
- El cuello vibra de lado a 58 Hz y la retracción CMT va a 39.1 Hz. Regla nueva del juez: f_n del cuello ≥ 2·f_CMT. La física elige el camino: apoyo intermedio, otro tubo u otro largo.
- **CAMPANA** (bahía nueva de B, abajo de tu módulo: y 96…150, z −12…24): nada tuyo baja de z 24. Su tiro pasa bajo tu cara de abajo; si eso cambia alguna temperatura tuya, se dice con números.
- **REGLAS.todoImprimible:** todo lo que tu juez cuenta como pieza impresa sale con su STL y su FMSH.
- Los 3 avisos de la ronda 1: se resuelven o se explican.

LA FRONTERA es `src/forja/lab/laboratorio-contrato.ts`. Se lee y NO se edita. Si algo no cabe: se diseña con lo que hay y se escribe «CAMBIO DE CONTRATO PEDIDO», con números, en el CIERRE.

## YA-EXISTE (prueba de ausencia)

- Todo lo de la ronda 1: el generador, el juez, las pruebas y el script de sólidos/KiCad en `scripts/laboratorio/`. Se modifica eso; no se hace un generador nuevo.

## TOCA

- (nada)

## CREA

- src/forja/lab/alambre.ts
- src/forja/lab/__tests__/alambre.test.ts

Los creó la ronda 1 y todavía no están en el commit base.

## BORRA

- (nada)

## PREEXISTENTE

- public/
- videos/
- scripts/
- models/
- docs/
- ordenes/
- src/lib/physics/
- src/forja/brep/
- src/forja/lab/laboratorio-contrato.ts
- src/forja/lab/__tests__/contrato.test.ts
- src/forja/lab/cuerpo.ts
- src/forja/lab/__tests__/cuerpo.test.ts
- src/forja/lab/placa.ts
- src/forja/lab/__tests__/placa.test.ts

## EVIDENCIA (se declara ANTES de trabajar)

- `vitest` del módulo en iangpu: todo verde, con el juez en 0 errores sobre el diseño real y los errores sembrados de la ronda 1 todavía cazados.
- Pruebas nuevas para lo nuevo de esta orden.
- Las salidas regeneradas en iangpu: STL/FMSH o KiCad.
- `tsc --noEmit` en iangpu: sin errores nuevos (la base son 58).
- `node scripts/orden-gate.cjs --orden ordenes/2026-11-06-lab-alambre-r2.md`: VERDE.

## CIERRE (se llena al terminar)

- orden vs entregado:
  - A.POT a z 210: K06 sale del portapuntas hacia −x, sube por x = −46, fuera de la pluma, y entra derecho por +y al pasamuros.
  - El pasamuros de A.POT se mudó a la espina del empuje: la pared de z 210 es de esa pieza. En la ronda 1 el barreno quedaba en el pie, que acaba en z 190; el juez de entonces no lo veía y ahora A17 sí lo caza.
  - K06 dobla con radio ≥ 6·OD = 39 mm, por REGLAS.dobladoMinK. Regla nueva A18.
  - D4: OUT− va al portapuntas con Silfos 15 y fundente, porque el portapuntas es de latón.
  - D4, consecuencia: el inox NO lleva Silfos, porque el fósforo hace fosfuros frágiles con el níquel y el hierro. Las juntas de inox, cuello–portapuntas y tirantes–collarín, van con plata 45 % sin fósforo y fundente. Regla nueva A21.
  - D5: el carrete sigue abajo con su arco de PTFE, sin cambio.
  - D5: la loca es 625-ZZ. Sus dos tapas de lámina cierran el barreno, así que la tapa del imán se pega con epóxico a la cara del aro exterior y no pasa del Ø16: a 0.8 mm está el rodillo.
  - D5: el perno impreso ya no asoma de la cara del aro. El AS5600 se recorrió a y −10…−8.4 con el mismo entrehierro de 2 mm.
  - f_n del cuello ≥ 2·f_CMT: A16 pasó de aviso a error. Se calcularon los tres caminos y ganó el apoyo intermedio: un collarín de latón que desliza en el cuello y 2 varillas de inox Ø3 ancladas a presión en el frente de la V del bloque.
  - CAMPANA: nada de A baja de z 24 sobre su huella. Regla nueva A19; también revisa las cajas de los escudos.
  - REGLAS.todoImprimible: los 6 escudos de aluminio entran en 19 ranuras que están en las piezas impresas y en sus STL. El escudo del carrete cuelga de una ranura en la pared del pie. Regla nueva A20.
  - Aviso 1 de la ronda 1, A12 a 67.1 °C: resuelto. El peor PETG con escudos queda a 58.1 °C.
  - Aviso 2 de la ronda 1, A16 a 57.7 Hz: resuelto. El cuello da 132.9 Hz.
  - Aviso 3 de la ronda 1: era la línea info N, que el panel contaba como aviso. Sigue como info.
  - Modelo corregido, lo más importante de la ronda: la ronda 1 ponía el cuello y el cable en aire a 35 °C y escondía que el cuello, en el eje de la pluma, le lleva el gas caliente al zócalo de PETG.
  - Ahora el cuello, el cable y los tirantes son aletas por diferencias finitas en su ambiente real: gas de la pluma más radiación del arco y de la mesa.
  - Los escudos ahora tapan también la radiación del arco, que viene de abajo igual que la de la mesa.
  - Las caras de PETG se juzgan con el peor caso, sin campana; el cuello, el cable y los tirantes, con la campana prendida que pone el contrato. El caso sin campana sale como aviso con su número.
  - Archivos tocados, sólo los de A:
  - src/forja/lab/alambre.ts
  - src/forja/lab/__tests__/alambre.test.ts
  - scripts/laboratorio/alambre-solidos.cjs
  - models/stl/laboratorio/alambre/
  - public/modelos/laboratorio/alambre/
  - El script de sólidos sólo ganó el primitivo cilDir, un cilindro inclinado para las anclas.
- números:
  - K06 mide 324 mm del portapuntas al puerto, con 95 mm desnudo; la silicona empieza a 178 °C.
  - K06 toca PETG a 316 mm, en el pasamuros, a 58.1 °C. Con la ruta vieja al puerto nuevo eran 73.7 °C.
  - K06 dobla con radio mínimo 38.5 mm, medido sobre la ruta muestreada; tolerancia 0.5.
  - Cuello de lado, objetivo 2 · 39.1 = 78.1 Hz.
  - Otro tubo: manda la raíz, no el tubo. El zócalo es una viga sobre resortes de Winkler con k_s = E del PETG, y la cueva del rodillo lo limita a 14–20 mm.
  - Otro tubo, resultados: 6×4 42.5 Hz · 8×6 56.9 · 8×4 59.5 · 10×6 61.4 · 10×4 59.8 · 12×6 51.0. Ninguno llega.
  - Un 10×6 en 16 mm de zócalo es 2.98 veces más blando que empotrado.
  - Otro largo: el 6×4 necesita 136 mm libres, lo que pone PETG a z 189 a 90 °C. No sirve.
  - Apoyo intermedio: 132.9 Hz. En x 335 Hz, en y 231 Hz, cada varilla 134/133 Hz, el tramo del cuello 376 Hz.
  - Los 58 Hz de la ronda 1 no contaban la raíz ni el cable que cuelga. Con los dos, el 6×4 solo da 42.5 Hz.
  - Térmica con la campana del contrato: portapuntas 362 °C, con Silfos hasta 450 · zócalo del cuello 55.2 °C · PTFE desde z 123, a 110 °C · anclas 44 y 43 °C · cable al PETG 58.1 °C.
  - La punta baja 282 µm al calentarse; la ronda 1 decía 128 µm. Es más porque el cuello está en la pluma.
  - Térmica sin campana, la falla: zócalo 86.3 °C · PTFE 200 °C · anclas 55 y 51 °C · cable 58.2 °C.
  - El PTFE se puso donde aguanta aun sin campana. Deja 70 mm de inox desnudo, con P_cr de 7.6 N contra 5.41 N: no culebrea.
  - Campana, Dalla Valle con pestaña: 0.5 m/s a 96 mm del arco dan 129 m³/h, que diluyen los 84 W convectivos a +1.9 K.
  - Lo que escapa con η = 80 %, que es SUPUESTO, entra a la boca a z 7.5 en el modelo de superposición. La pluma entera escaparía.
  - Zócalo según lo que captura la campana: 0 % 86.3 °C · 40 % 72.7 · 50 % 68.8 · 60 % 64.7 · 80 % 55.2 · 90 % 49.2. Hace falta ≥ 60 %.
  - Su tiro sí cambia mis temperaturas: le baja el zócalo de 86.3 a 55.2 °C.
  - Su caja además le tapa la mesa a la espina del pie: F de 0.043 a 0.023, unos −5 K. Eso no se cuenta, porque la forma de la campana es de B; por eso la espina del pie lleva su escudo.
  - Escudos: 6 tiras, bajo la pared del eje, la espina del pie, las 2 costillas, el fondo en V y el clip. Sin ellos el peor PETG llega a 114 °C.
  - El carrete pasa de 126 a 37 °C con su escudo en L.
  - Lo que no cambió: topología directa · ×2.01 a 6 m/min con 0.7 A rms · 29.5 µm por micropaso · retracción a 39.1 Hz con 0.85 A · NEMA a 63.9 °C · F 5.41 N · loca 37 N · AS5600 12.3 µm por cuenta · PTFE de 162 mm con juego de 21 µm · riel con holgura 0.42 · 0 tornillos.
- evidencia:
  - vitest en iangpu: 49/49. Son las 33 de la ronda 1, con todos sus errores sembrados todavía cazados, más 16 nuevas.
  - Las nuevas cazan: la ruta vieja de K06, el pasamuros olvidado en el pie, el cuello sin apoyo, un tirante sin ancla, una pieza dentro de la campana, Silfos en inox, latón sin fundente, un escudo sin ranuras y una tapa que pasa del aro.
  - El juez sobre el diseño real: 0 errores, 1 aviso y 1 info. El aviso es A11, la falla sin campana, que pide el termostato.
  - tsc --noEmit en iangpu: 69 en total. 11 son de cuerpo.ts y cuerpo.test.ts, que B está editando al mismo tiempo; fuera de B quedan 58, la base; 0 de alambre.
  - OCCT: pie-carrete 532 tris, 1 sólido, 100 × 81.6 × 150; soporte de 12 mm², en los techos de 1 mm de sus ranuras.
  - OCCT: espina-empuje 3616 tris, 1 sólido, 100 × 183.8 × 155; soporte sólo en puentes declarados: NEMA 40.8, rodillo 12, broche 11, loca 4.2, anclas 3, resalte 2.4, anillo del zócalo 1.1, ranuras 1.
  - OCCT: carro-loca 192 tris, 20 × 17.6 × 10.7, sin soporte · eje-carrete 522 tris, 20 × 19.9 × 57.3, labio de 0.65 · tapa-iman 500 tris, 15.2 × 15.2 × 3.9, sin soporte. Todas caben en la K1.
  - Las STL, los .bin y resumen.json se regeneraron en iangpu y se trajeron a la laptop.
  - orden-gate: VERDE.
- preguntas abiertas:
  - CAMBIO DE CONTRATO PEDIDO: un termostato NC 70 °C, clase KSD301, pegado al zócalo del cuello y en serie con la cadena SD de C, como MESA.TERM.
  - Sería una conexión nueva, K14, de C.SEN a A.SEN: hilos T1 y T2, 24 AWG, señal. Cabe en la ventana de A.SEN.
  - Por qué: sin campana el zócalo llega a 86.3 °C; con ella, a 55.2. Las caras de PETG aguantan sin campana; el cuello no puede, porque está en el eje de la pluma.
  - La otra salida es que C sepa si el extractor gira y no deje prender el arco sin él. Hay que escoger una.
  - Medir la captura de la campana con humo: el zócalo necesita ≥ 60 % y el SUPUESTO es 80 %.
  - Medir con termopar el portapuntas y el zócalo; también el ε del inox y del cable en la pluma.
  - Medir el E del PETG del zócalo: la raíz del cuello depende de él.
  - ¿Ian consigue plata 45 % sin fósforo además del Silfos? Va sólo en el inox.
  - ¿El portapuntas es la 15AK o una pieza torneada? Necesita arriba un barreno de Ø6 × 8 para el cuello y de lado uno de Ø3.4 para el cobre de OUT−.
  - La punta baja 282 µm en caliente. ¿C lo compensa en la distancia o se acepta?
  - La tapa del imán va pegada con epóxico: no es tornillo, pero tampoco broche. El 625-ZZ no deja otra.
  - Siguen por medir los de la ronda 1: la pared del tubular, los rizos, la fuerza con dinamómetro, la Rth del NEMA y la emisividad del escudo con humo.
  - Segunda pasada, K14 aceptado: el KSD301 va en un asiento de la espina del empuje, con la tapa a 0.8 mm del barreno del zócalo y 13.5 mm arriba de su boca; sus hilos suben por su canal a la canaleta de señal junto a K08, que ahora va por la izquierda a 15.8 mm de K06 y a 28.9 mm de K07; la regla A22 elige de la serie el de 55 °C ±3, que lee 48.2 °C trabajando y corta con la boca del zócalo a ≤ 69.3 °C; uno de 70 °C nunca cortaría porque sin campana lee 69.8 °C, así que CAMBIO DE CONTRATO PEDIDO: la nota de K14 dice 70 °C y debe decir 55 °C ±3; de paso se corrigió la gota de los barrenos, que en la ronda 1 se cruzaba, y K07 quedó sola en su canaleta; vitest 53/53, tsc 58, gate VERDE.
  - Tercera pasada, el zócalo para 0 % de captura por decisión del orquestador: el cuello ya no toca PETG; entra a un inserto de silicato de calcio de Ø16, el de D1, que el PETG abraza; la regla probó PTFE y silicato de Ø8 a Ø24 y ganó el silicato Ø16, el primero donde además cabe el KSD301; con la pluma directa el cuello llega a 89.5 °C y el PETG que abraza el inserto a 62.3 °C, donde sale el PTFE a 62.7 °C; con 80 % de captura, sólo informativo, el PETG del inserto queda a 45.2 °C; K14 se queda en 70 °C ±3 con la tapa tocando el inserto: lee 62.3 °C trabajando, no corta antes de 67 y corta a ≤ 73, antes de 75 que es Tg del PETG − 5; se retira el pedido de 55 °C y K14 queda como estaba en el contrato; el cuello de lado sigue en 132.9 Hz; la punta baja 506 µm en caliente; vitest 55/55, tsc 58 con 0 de alambre, gate VERDE.
