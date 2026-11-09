# ORDEN L·2: el cuerpo del laboratorio, ronda 2

ESTADO: hoy, agente de fondo. ian aprobó tus 8 pedidos de la ronda 1 («dale los cambios»). El contrato v2 ya está escrito: `src/forja/lab/laboratorio-contrato.ts` (`CONTRATO_RONDA = 2`, `CAMBIOS_R2`, `DECISIONES`). La ronda 1 del cuerpo está en `ordenes/2026-11-05-lab-cuerpo.md`.

BASE: 32f3e93

OBJETIVO: el cuerpo puesto al día con el contrato v2, sin piezas pendientes y con cero errores de su juez.
- **Que no truene.** Con el contrato v2, `disenarCuerpo()` hoy truena con `TypeError: Cannot read properties of undefined (reading 'puntos')`: una ruta que no se encuentra. Primero se arregla eso: una conexión sin ruta es un ERROR del juez con su porqué, nunca una excepción.
- **Lo que viene del contrato v2:**
  - BASE y1 230; la COLUMNA de 80 mm de fondo con el pie completo; el IEC en la pared nueva (y 190…230);
  - C.OUTP (−40, 48, −60) +y; C.PARO (85, −85, −50) +x; C.FAN (−119, 20, −50) con K09 como puente (sin canal: un peine sujeta los hilos de fábrica);
  - PLACA_PCB z1 −26 y cede x −119…−96 en y −100…10, donde va el DIFUSOR (bahía tuya), impreso;
  - C.MESA, MESA.NTC, VMESA, MESA.TERM y K11/K12/K13 ya son del contrato. Se borran `PUERTOS_PEDIDOS`, `CONEXIONES_PEDIDAS` y los `PEDIDOS` aplicados: el generador lee el contrato.
- **El MARCO va en (−40, 80, −9) +y**, no en x = 0 como pediste: así K05 y K06 viven en el mismo plano que C.OUTP y A.POT.
  - K05 hace su tramo al aire dentro de la CAMPANA, que es tuya.
  - `REGLAS.lazoArco`: K05 y K06 a ≤ 25 mm entre ejes de C al pie de la columna.
  - El área del lazo se calcula con la ruta real de K05, no con una recta.
- **La CAMPANA** (x ±45, y 96…150, z −12…24):
  - una boca baja detrás de la placa, con la garganta al ducto de la columna;
  - captura ≥ `REGLAS.capturaHumoMin` (0.5 m/s) en el arco, por Dalla Valle con la curva del extractor y las pérdidas del ducto;
  - material según su temperatura: PETG donde el juez lo deja, aluminio o silicato donde no.
- **El termostato de la mesa (MESA.TERM):** su asiento en el piso del ducto y el paso de K13.
- **`REGLAS.todoImprimible`:** salen como piezas con STL y FMSH las 27 tapas de los canales, la tapa de arriba de la columna, los broches columna–columna y charola–cubierta, y el difusor. Hoy son números.
- **D1:** PETG y silicato de calcio de 25 mm.
- **D4:** Silfos en la oreja del marco.
- **D6:** el ventilador de la mesa es de 80 × 80 × 38 y 0.55 A.

LA FRONTERA es `src/forja/lab/laboratorio-contrato.ts`. Se lee y NO se edita. Si algo no cabe: se diseña con lo que hay y se escribe «CAMBIO DE CONTRATO PEDIDO», con números, en el CIERRE.

## YA-EXISTE (prueba de ausencia)

- Todo lo de la ronda 1: el generador, el juez, las pruebas y el script de sólidos/KiCad en `scripts/laboratorio/`. Se modifica eso; no se hace un generador nuevo.

## TOCA

- (nada)

## CREA

- src/forja/lab/cuerpo.ts
- src/forja/lab/__tests__/cuerpo.test.ts

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
- src/forja/lab/alambre.ts
- src/forja/lab/__tests__/alambre.test.ts
- src/forja/lab/placa.ts
- src/forja/lab/__tests__/placa.test.ts

## EVIDENCIA (se declara ANTES de trabajar)

- `vitest` del módulo en iangpu: todo verde, con el juez en 0 errores sobre el diseño real y los errores sembrados de la ronda 1 todavía cazados.
- Pruebas nuevas para lo nuevo de esta orden.
- Las salidas regeneradas en iangpu: STL/FMSH o KiCad.
- `tsc --noEmit` en iangpu: sin errores nuevos (la base son 58).
- `node scripts/orden-gate.cjs --orden ordenes/2026-11-06-lab-cuerpo-r2.md`: VERDE.

## CIERRE (se llena al terminar)

- orden vs entregado:
  - **Que no truene:** hecho.
    - El `TypeError` venía de K13: está en el contrato v2 y nadie lo ruteaba.
    - Ahora toda conexión sin ruta es una ruta `sin-ruta` con su porqué, y el juez la marca C1 (error). Pasa igual con un puerto que no existe, con un A* sin camino o con una conexión que nadie rutea.
    - `rutear` ya no lanza excepciones.
  - **Contrato v2:** se borraron `PUERTOS_PEDIDOS`, `CONEXIONES_PEDIDAS` y los pedidos P1–P8. El generador lee el contrato (K01–K14).
    - La rejilla del A* ahora llega a y 230.
    - El IEC está en la pared nueva (cuerpo y 192…226, patas en y 190).
    - La columna es de 80 de fondo y su pie apoya completo.
    - El carril del pie va en y 170.
  - **K14** (llegó a media ronda) va en el canal de K08: 5 hilos en 5 × 5, llenado 18 %. Se dobla con el hilo más grueso (R 7.2) y se imprime una sola vez.
  - **K09:** puente. Los hilos de fábrica van por el travesaño del ventilador y un peine (poste del piso) los sujeta a 9 mm del pad de C.
  - **MARCO en x −40 y lazo del arco:**
    - K05 y K06 cambian de lado entre C y la columna, así que se CRUZAN. El A* pide 2R entre cualquier par de vueltas y no ve dos S seguidas.
    - Por eso K05 y K06 van a mano: K06 sube a z −55 y K05 baja a −69.5, con 14.5 mm entre ejes en el cruce y 4 mm de PETG entre los cobres.
    - El juez los revisa igual que a los demás canales.
  - **K05 al aire en la campana:**
    - Su tubo sube por el pie de la columna (x −30, y 190) hasta el piso del paso del humo.
    - De ahí el cobre va al aire: U arriba, corre a −y por el paso, la garganta y la campana, hace una S oblicua y llega a la oreja (Silfos, D4).
    - Lleva manga de fibra de vidrio en los primeros 31 mm y una silla de silicato bajo el cable en y 91…97.
  - **Campana:**
    - embocadura de aluminio de 1 mm en U (comprada/cortada), con bocina arriba y a la derecha;
    - cuerpo de PETG impreso que es un difusor suave (2θ ≈ 12°);
    - garganta en la cara de la columna;
    - paso por el pie con techo a 45°;
    - collar Ø100 atrás a z 10 (P10).
  - **Material de la campana:** los dos labios que ven el arco pasarían de 70 °C si fueran de PETG (163 y 128 °C), por eso son de aluminio. Lo demás es PETG.
  - **MESA.TERM:**
    - asiento en la charola: dos rieles y un tope; el termostato va acostado con la lata abajo;
    - paso de los 6 hilos de la mesa: ranura de 4 × 20 mm (80 mm²) sobre la columna de islas de C (dato de C);
    - broche de K13.
  - **Piezas sueltas (REGLAS.todoImprimible),** 65 en 12 camas, cada cama con STL y FMSH:
    - 50 tapas de canal, con patas de broche;
    - 4 grapas columna ↔ columna (caras izquierda, derecha y atrás);
    - 8 remaches charola → cubierta;
    - la tapa de arriba de la columna;
    - el difusor;
    - la campana.
  - **Codos de canal:** ahora van cerrados (el cable se empuja). El canal también va cerrado en el bloque macizo del pie de la columna, abajo de la cubierta.
  - **Cuna del disipador de C** (orquestador): el disipador se apoya en la PCB de C.
    - Al frente lo detiene un tope de silicato de 6.7 mm, con 0.3 mm de juego, en un bolsillo de PETG de la pared.
    - Hacia −x, la boca del difusor queda a 1 mm de aire.
    - El PETG nunca toca el aluminio.
  - **Difusor:** de 80 × 80 a 106 × 55, con techo a 45°. Lleva el chorro a toda la altura del disipador de C (en su posición de la ronda 2).
  - **Decisiones aplicadas:** D1 (PETG y silicato de 25 mm), D4 (Silfos en la oreja: el juez H3 revisa el sólido de 645 °C) y D6 (ventilador de la mesa de 80 × 80 × 38, 0.55 A).
  - **Juez nuevo:**
    - C9: sale y llega en la dirección de cada puerto;
    - C10: REGLAS.lazoArco;
    - I1: todo imprimible;
    - H4: K05 al aire;
    - H6: el termostato;
    - H7: la cuna;
    - A3: Dalla Valle.
  - **Pruebas:** siguen cazándose los 11 errores sembrados de la ronda 1, más 8 nuevos.
- números:
  - **Tejas:** 13 (las mismas), 0 tornillos, 0 operaciones fallidas.
    - base: 4, de 150 × 150 × 105 y 150 × 190 × 105;
    - cubierta: 4, de hasta 170 × 190 × 33;
    - charola: 2;
    - columna: 110 × 105 × 240 y 110 × 80 × 220;
    - mordazas: 1.
  - **Piezas nuevas:** 65 en 12 camas: 126 cm³, 161 g y ~4 h.
  - **Total:** 2 378 cm³ extruidos, 3.0 kg de PETG, ~82 h a 8 mm³/s (SUPUESTO).
  - **Triángulos:** 24 720 en las 25 FMSH (17 926 de tejas y 6 794 de piezas).
  - **Soportes:** 0–12 % por teja; la peor es cub-td con 12.2 %. En las piezas: 0–10.6 % (el difusor marca 2 172 mm² en la brida).
  - **Captura de la campana:**
    - 135 m³/h a 79 Pa (Dalla Valle pide 129);
    - X 96 mm del arco a la cara de la boca (3 080 mm²);
    - **0.525 m/s en el arco** (regla 0.5).
  - **Pérdidas del humo (Pa):**
    - boca 20.9 (ζ 0.125);
    - difusor de la campana 2.5;
    - campana → paso 12.3;
    - paso → collar 5.1;
    - fricción 5.2;
    - manguera 33.2.
  - **Collar arriba (ronda 1):** los dos codos de la columna dejan 107 m³/h y 0.416 m/s. Por eso P10.
  - **Pluma para A (K14):**
    - Dalla Valle da la velocidad de captura, no una fracción.
    - La pluma (Heskestad, 84 W convectivos de A) sube los 23 mm al zócalo en 11 ms a 1.5 m/s.
    - La campana la corre 5.9 mm, con un ancho de 2.8 mm.
    - **Fracción que la campana aparta del zócalo antes de que pegue: ≈ 0 %** (2·10⁻⁵).
    - La campana se lleva el humo después, cuando corre bajo el fondo de A, pero no protege al zócalo del golpe directo.
  - **Lazo K05/K06:** 252 cm² con la ruta real de K05 (canal + aire); la ronda 1 daba 179 con K05 en recta.
    - Separación de C al pie de la columna: ≤ 24.7 mm entre ejes (regla 25).
    - K05 mide 376 mm de canal + 134 al aire; K06 mide 492.
  - **K05 al aire:**
    - λ 53 mm con h 54 W/m²K;
    - 300 °C en la oreja → **52 °C donde entra a su tubo**;
    - holgura mínima a PETG caliente: 2.7 mm (techo de la campana a 130 °C);
    - sobre silicato: 1.5 mm.
  - **PETG ≤ 70 °C en todo:**
    - escape: 62.8 °C;
    - repisa de los postes: 59.3;
    - cubierta junto a la placa: 48.6 / 51.6;
    - campana por dentro: 31–34;
    - detrás de la embocadura: 35.5.
  - **Mesa:** aletas de 3 mm a paso 12; sostiene 150–300 °C; τ 6.6 min; fuga 326 °C (521 sin ventilador).
  - **Termostato:**
    - con el ventilador, el piso bajo él está a 40.3 °C (margen de 24.7 K para no abrir);
    - sin ventilador abre con el bloque a 134 °C y el piso del centro a 70.1 °C.
  - **Cuna del disipador** (con el disipador a 90 °C):
    - pared detrás del tope: 63.3 °C;
    - pared que ve el disipador: 52.8;
    - boca del difusor: 41.5.
  - **Estructura:** columna σ 0.18 MPa (SF 138, pie cortado por el humo) · espiga SF 37 · pie SF 16 · cubierta SF 19 · postes SF 3.7 · la punta baja 24 µm.
  - **Broches y patas:** ε de 0.73 a 1.20 %; las piezas llegan a 1.11 % como máximo (admisible SUPUESTO 1.5 %).
  - **Aire de C:** 26 m³/h a 17 Pa; el aire sube 4.7 K.
    - El difusor cubre 85 % del largo del disipador (106 de 125 mm) y 100 % de su altura.
  - **Cobre en canales:** 8.9 m de hilo.
- evidencia:
  - vitest en iangpu: 49/49.
    - El juez da 0 errores sobre el diseño real; queda 1 hallazgo «contrato» (K13 C9 → P9) y avisos C8 y H5.
    - Siguen cazándose los 11 errores sembrados de la ronda 1, más 8 nuevos.
  - tsc en iangpu: 59 = 58 de la base + 1 en `src/forja/lab/alambre.ts(1243)` (de A: `'T' is specified more than once`). 0 en mis archivos.
  - Sólidos en iangpu: 13 tejas + 12 camas, 0 operaciones fallidas.
    - STL en `models/stl/laboratorio/cuerpo/` con `resumen.json`.
    - FMSH en `public/modelos/laboratorio/cuerpo/`.
  - gate: VERDE.
- preguntas abiertas:
  - **CAMBIO DE CONTRATO PEDIDO P9:** MESA.TERM (60, −60, −22) −z → (45, −60, −22) +x.
    - De pie no cabe: entre el piso (−22) y las aletas (−15) hay 7 mm, y abajo quedan 2 mm hasta C.
    - Va acostado, con los hilos de lado.
    - A 20.5 mm de C.MESA, a la S de K13 le faltan 0.3 mm de recta.
  - **CAMBIO DE CONTRATO PEDIDO P10** (sólo la nota de COLUMNA): el collar pasa de z ≈ 300 a z ≈ 10. Captura 0.525 m/s contra 0.416 con el collar arriba.
  - **Para C:**
    - mi modelo del aire de C (rejillas + K 1.5 de la placa + difusor) da 26 m³/h, no los 37 que usa `termicaPlaca()`;
    - el tope de la cuna entra 0.7 mm en el margen de 1 mm que C dejó para las guías de B.
  - **Para A (K14):** la campana no aparta la pluma del zócalo del cuello (≈ 0 % contra el 80 % que supuso A). El zócalo tiene que aguantar la pluma directa (A ya mide 86 °C sin campana); el termostato K14 es la protección.
    - Nota: la cara de abajo de A sigue viendo la placa a 300 °C (304 °C sin escudo).
  - **Para Ian:**
    - ¿el termostato de la mesa va plano (clase KSD9700)?
    - ¿la embocadura de aluminio de 1 mm en U con el labio enrollado (r 8 arriba, 6 a la derecha) la doblas tú?
    - ¿qué extractor compras? (curva SUPUESTA: 200 m³/h libre, 250 Pa; la manguera de 3 m se come 33 de los 79 Pa)
    - K05 cuelga ~134 mm en el aire de la campana. Si el cal 8 de silicona se pandea, ¿le ponemos un soporte de silicato a la mitad?
  - **Después del cierre (P9 y P10 aceptados en el contrato):** K13 va ahora a MESA.TERM (45, −60, −22) +x, con el KSD9700 acostado en x 24…45 y la S a la mitad del tramo. `PEDIDOS` queda vacío. Se regeneró ducto-d (lo único que cambió). Resultado: vitest 49/49 sin hallazgos de contrato, el piso bajo el termostato a 41.7 °C, `tsc` en 58 y gate VERDE.
  - **Después del cierre (aire de C):**
    - El frente del disipador de C pasa a y −98.5: el tope queda con 0.8 mm de juego y no se mueve.
    - VENT_PCB es ahora uno de 80 × 80 × 25, 12 V, 0.25 A, de alta velocidad. SUPUESTO de clase: 79 m³/h libre y 55 Pa, ≈ 38–42 dB(A) contra ≈ 30–33 del anterior.
    - Con las mismas pérdidas (rejillas, difusor, placa) opera a **35.1 m³/h y 30.6 Pa** (el anterior daba 26.1 m³/h), y el aire de C sube 3.5 K en vez de 4.7.
    - El juez A1 ahora revisa los 27.6 m³/h que pide C.
    - Ninguna teja ni pieza cambia. vitest 51/51, `tsc` 58, gate VERDE.
