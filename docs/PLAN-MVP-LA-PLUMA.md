# PLAN MVP — La Pluma (el primer prototipo completo de la impresora de metal)

Fecha: 2026-11-04 · Estado: **PROPUESTA** (falta la aprobación de ian) · Antecedentes:
`docs/BITACORA-IMPRESORA-METAL.md`, `scripts/la-pluma/` (simulación ngspice),
`scripts/operador-revision-impresora-2026-10-31.py`, laboratorio
https://claude.ai/artifact/SxPuq4owLcKBFNr91UTjV7

---

## 1. Qué es el MVP

Una sola máquina completa que deposita metal a mano, armada, cableada y medida:

| pieza | qué es |
|---|---|
| **LA TORRE** | La fuente LRS-1200-48 abajo. Encima, una caja impresa atornillada a sus M4 laterales con toda la electrónica de La Pluma: Q1, Q3 y D1 en un disipador; la bobina de 41 µH en su compartimento ventilado; los 2 capacitores; Pico 2 + IR2110 + sensor; ventilador; PARO; conectores. |
| **LA PLUMA** | Mango impreso con punta MIG M6 de 0.8 mm para el Truper, gatillo, tubo PTFE y avance del alambre con el pulgar. |
| **LA MESA** | Placa de acero sobre azulejo, con pinza de tierra. |
| **EL FIRMWARE** | Control de corriente + ventana de ignición para el fundente + detección de cuello + atajo Q3 + energía medida por punto + telemetría al cuaderno. |

Una sola prueba decide si sigue la mecatrónica completa. Sus criterios se escriben en el paso 1, antes de armar.

## 2. Lo que ya está medido y calculado (no se repite)

- **Alambre Truper MICRO-1, E71T-GS de 0.8 mm, tubular sin gas.**
  - El contacto con fundente da de 3 a 100 Ω.
  - El fundente se rompe con pulsos de 100 µs o más y unos 30 V.
  - Micro-gotas con toques de 1.2–2.1 J a 42 V.
  - Fusión a 51 V / 100 Hz: blanco, y se pega. Bitácora, 6 y 8 de junio.
- **Monte Carlo** (`scripts/montecarlo-deposicion-acero.py`):
  - cordón mínimo de ~0.92 mm;
  - punto recomendado 250 W a 16 mm/s, que da un ancho de 0.94 ± 0.09 mm;
  - régimen pulsado.
- **Simulación ngspice de La Pluma** (`scripts/la-pluma/`):
  - las protecciones bajan el golpe en Q1 de 234 a 78 V;
  - el atajo Q3 baja la chispa de 43 a 0.1 mJ;
  - el tope de duty mata el arco cuando el lazo es rápido.
- **Fuente LRS-1200-48:** 225×124×41 mm, 8× M4 laterales, 4× M4 abajo, ventilador propio.
- **Los experimentos E0–E4 del laboratorio se pliegan al MVP.**
  - La máquina se mide sola al arrancar: R del alambre, y R de la bobina con la pinza en corto.
  - La prueba de puntos del MVP *es* E3.

## 3. Decisiones (y por qué)

1. **Modo de depósito del MVP: puntos pulsados con energía medida, no cordón continuo.** Es lo que el Truper ya hizo en junio y lo que pide el Monte Carlo. El cordón continuo necesita alimentador, y eso va después del MVP.
2. **Circuito: La Pluma** (buck del lado alto, pieza a tierra) **con ventana de ignición.**
   - Al tocar, se dejan hasta ~40 V durante 300 µs como máximo para perforar el fundente.
   - Después, corriente controlada con tope de duty.
   - La simulación de octubre usó alambre sólido de 0.6 mm. Se vuelve a simular con el contacto del Truper antes de dibujar la caja.
3. **CAD: La Forja, por dos vías.**
   - **Modelado:** el kernel OCCT en Node, sin GPU y sin el límite de ~6 cuerpos de la app. Ahí se modela, se ensambla y se exportan STL/STEP.
   - **Renders:** la app en iangpu, solo para las fotos con GPU real.
   - Blender no hace falta para el MVP.
4. **Lo que falte en La Forja se crea reutilizable** (§5), bajo órdenes (regla #0.7).
5. **Imprimir en PETG o ASA, no en PLA.** La bobina disipa ~35 W y el disipador ~40 W a 40 A.
6. **La caja va atornillada a la LRS**, para que todo sea un solo bulto y no haya cables de 48 V sueltos.

## 4. Los pasos

| paso | quién | qué sale | revisión |
|---|---|---|---|
| **0** | ian, 10 min | Inventario (§7). | — |
| **1** | Claude | Física del Truper (R por mm, I²t del tubular) + re-simulación ngspice con el contacto de fundente + Monte Carlo del MVP → energía por punto, ventana de ignición y **criterios de éxito escritos antes de armar**. | ✔ ian ve la hoja de números |
| **2** | Claude | Lo que falta en La Forja: órdenes A–D de §5, cada una con sus pruebas. | gates verdes |
| **3** | Claude | **El MVP en 3D**, en este orden: 1) acomodo interior con reglas eléctricas; 2) cableado en 3D; 3) renders (ensamble, explosionado y corte); 4) STL por pieza; 5) BOM: tengo / compro / imprimo. | ✔ ian revisa los renders antes de imprimir |
| **4** | Claude | Firmware La Pluma (`firmware/forja-rp2350/la-pluma/`), guía de armado, diagrama de cableado y protocolo de la prueba en una página. | firmware probado contra la simulación |
| **5** | ian | Imprimir, armar con la guía y hacer una sesión de prueba. | — |
| **6** | juntos | Leer la telemetría, compararla con lo escrito en el paso 1 y decidir: mecatrónica completa (alimentador, ejes) o corregir. | — |

Las reglas eléctricas del acomodo interior (paso 3) son:

- el lazo caliente Q1–D1–4.7 µF, corto;
- la bobina lejos del metal y con aire;
- la tierra en estrella en la pieza.

## 5. Lo que se crea en La Forja (reutilizable), una orden por bloque

Base del sondeo (2026-11-04): el kernel ya modela todo lo que hace falta: shell, fillet, revolve, booleanas y planos arbitrarios. Lo que falta está en las capas de arriba.

- **A. Exportar ensambles.**
  - STL por pieza (hoy `meshToStlBlob` es privado, `ForgeBRepStudio.tsx`).
  - STEP con nombres desde Node. El escritor ya existe y solo lo usan los moldes: `occt.ts: exportSTEPEnsamble`.
  - Verbos nuevos de `ForjaAgent`: exportar, `loadDoc`, sección, cámara y captura de solo el canvas.
- **B. Rotación en 3 ejes y color/material por componente.**
  - Rotación `rx`/`ry` en `Component`, `buildComponent` e `insertPieza`. Hoy solo existe `rz`, pero `transformShape` ya gira sobre cualquier eje.
  - Color/material por componente. Hoy hay uno solo para todo el documento.
- **C. Biblioteca eléctrica paramétrica** (`src/forja/brep/` + `src/lib/parts/`). Extiende `scripts/componentes-reales.cjs` (TO-220, capacitores radiales, bornera); no lo duplica. Piezas:
  - TO-220 con disipador y mica;
  - capacitor snap-in;
  - **bobina de aire que calcula su L y su R con su geometría**;
  - Pico 2;
  - IR2110 DIP-14;
  - placa perforada;
  - borneras;
  - ventilador con rejilla;
  - botón de 22 mm;
  - conector GX12;
  - prensaestopa;
  - inserto térmico M3/M4;
  - fuente LRS-1200-48;
  - punta MIG M6 con portapunta.
- **D. Generador de caja.**
  - Entra la lista de piezas colocadas; sale la caja: paredes, tapa con tornillos, postes con inserto, rejillas, recortes de panel y holguras de impresión.
  - Suma un chequeo de pared mínima al de voladizos que ya existe (`mech/dfm.ts`).
- **E. Opcional:** BOM de ensamble y vista explosionada genérica. Hoy solo existen para moldes y para el reductor cicloidal.

Cada orden lleva su YA-EXISTE (del sondeo), TOCA/CREA/BORRA y EVIDENCIA, y se juzga con `node scripts/orden-gate.cjs`.

## 6. Riesgos

- **El fundente del Truper está hecho para arco.** En modo resistivo puede dejar escoria atrapada y humo con fluoruros, así que hace falta ventilación. El plan B ya está identificado: ER70S-6 sólido de 0.6 mm (Infra, $159/kg).
- **La bobina de aire es grande y caliente.** Calculo ~80–90 mm de diámetro. Define el tamaño de la caja, así que se mide en el paso 0.
- **La cama de impresión.** La base de la torre mide ~225×124 mm. Si la cama es de 220×220, la caja se parte en dos o se imprime en diagonal.
- **Límites de la app de La Forja.** Se cae con más de ~6 cuerpos, y el heap WASM se degrada después de 6–8 reconstrucciones. Por eso se modela en Node y los renders se hacen por grupos.
- **iangpu es compartida** con la producción de video (`gpu.lock`). Los renders entran a la cola.

## 7. Lo que necesito de ian (paso 0)

1. Foto de las piezas: la bolsa de AG y la mesa.
2. Número de parte de los MOSFETs que llegaron, y cuántos son.
3. ¿Hay IR2110? ¿TC4422? ¿El sensor es ACS758-100 u OKY3310?
4. Impresora (modelo o tamaño de cama) y filamento disponible: PLA, PETG o ASA.
5. Medidas de la bobina de 41 µH, con regla: diámetro y largo.
6. ¿Ventilador de 12 V y disipador que ya tengas? Con sus medidas.

---

## 8. Actualización 2026-11-04 (tarde): el cañón de gotas y el circuito perfecto

Pedido de ian: «dos ondas en el cable… hacer danzar la gota para imprimir directamente desde la gota; arma el circuito perfecto primero y luego ajustamos a lo que hay; quiero ver el banco de pruebas primero».
Página: https://claude.ai/artifact/HoJBRPxPb1UF3vY7okToKJ · scripts: `scripts/canon/` (`canon_gota.py`, `canon_corriente.py` + `.out`).

**Lo que encontramos (calculado, falta banco):**

1. **Para que la corriente haga bailar la gota tiene que cruzarla.** El cañón es un modo de arco: base de 40 A más una onda de 30 A, sin bajar nunca de ~10 A. Es el régimen para el que está hecho el Truper sin gas.
2. **La resonancia cambia el pellizco de 194 A por una onda de 13–60 A**, según el Q real de la gota.
   - Soltarla tarda unos 10 ciclos (~15 ms), y en ese tiempo la gota se sale de su resonancia.
   - Por eso la onda tiene que bajar de frecuencia junto con la gota.
3. **El arco es el oído.**
   - El arco sube 10 V por mm (medido en junio), así que la gota que baila mueve su voltaje 0.2–0.9 V.
   - Un lock-in sobre ese voltaje, después de un golpecito de 10 A cada 4 ms, da el tamaño a ±0.3 %, y también qué tan rápido crece.
   - Monte Carlo de 60 gotas, con avance ±10 % y ruido de 10 mV:
     - con oído, se sueltan el 100 % y la dispersión es de 1.3–1.5 µm;
     - a ciegas, se sueltan el 65–93 % y la dispersión es de 7–9 µm.
4. **El circuito perfecto (ngspice)** es La Pluma conmutando a 100 kHz, con lazo rápido y alimentación anticipada.
   - Dibuja 40 + 30 A a 668 y a 1268 Hz con −1.7° de retraso y ±1.3 A de rizo.
   - El lazo de hoy (20 kHz) pierde un tercio de la onda y llega 52° tarde.
   - Pendiente de diseño: a 100 kHz el golpe en Q1 llega a 96 V. Se cambia el TVS de 68 V por uno de 100 V o por un clamp RCD.

**Cambios al plan:**

- El MVP pasa de pluma de mano a **banco sobre la impresora vieja**: ejes X/Y/Z, y su extrusor como alimentador con un rodillo de 0.8 mm. La pluma queda para el modo contacto, con la misma caja.
- **Q3 y el oído van en la cabeza**, a unos 2 cm de la punta, con cables Kelvin a la punta y a la placa.
- **Dos Picos:** el cerebro A lleva la corriente a 100 kHz, la onda, el lock-in y el disparo; el cerebro B lleva los ejes, el alimentador y la telemetría.
- **Modos:**
  - contacto: duty máximo 0.22, sin arco posible;
  - arco/cañón: duty máximo 0.75, con PARO por hardware.
- **En La Forja**, además de la caja, se diseñan la cabeza y el alimentador.

**Paso 0, más una pregunta:** ¿sigue armada la impresora vieja? Modelo, recorrido de los ejes y qué extrusor trae.

## 9. Corrección de ian (2026-11-04): experimento mínimo, no impresora

«Por eso armaría un experimento mínimo, no una impresora 3D… este es el experimento real, la pluma también. Lo que quiero es que controlemos todo, pues no existe la maquinaria, no existe el circuito y siempre hay limitantes.»

**Lo que queda:**

- **La pluma en un soporte con tornillo Z** (M6 de 1 mm por vuelta, marcas de 0.1 mm). El cero lo da el toque eléctrico. Lleva un resorte calibrado para la fuerza de contacto (F = k·x).
- **La placa sobre azulejo**, en un riel con muescas cada 2 mm.
- **El circuito y un solo Pico.**
- **Nada de impresora ni de alimentador.** El alambre se avanza a mano entre eventos de 20 a 100 ms.
- **Q3 y el oído (Hall + Kelvin) pegados a la pluma.**
- **El circuito se arma listo para el cañón** (100 kHz, ADC rápido, TVS de 100 V), aunque primero se use en contacto.
- **Cada evento se guarda crudo** (V e I a 500 kS/s, unos 40 KB) en el cuaderno.

**Orden de los experimentos:**

1. Fusible.
2. Puntos por contacto con fuerza medida.
3. Campanazo, que mide el Q de la gota y el ruido del arco. El criterio se escribe antes de medir:
   - Q ≥ 25 y ruido ≤ 0.3 V: el cañón va.
   - Q ≤ 10: se queda como MIG pulsado.
   - Sin pico visible con el Truper: se repite con alambre sólido.
4. Cañón, si pasa el criterio.

**Robustez (Monte Carlo, Q = 30):**

| ruido | sueltan | dispersión |
|---|---|---|
| 300 mV | 100 % | 2.5 µm |
| 1 V | 77 % | 12 µm (ya no gana contra disparar a ciegas) |

Con Q = 10 y una onda de 30 A no se suelta ninguna gota.

**En La Forja:**

- la caja;
- la pluma con su tarjeta;
- el soporte con el tornillo Z;
- el riel con muescas;
- el calibre de alambre afuera.

## 10. El banco, pieza por pieza (2026-11-04)

Página v3: https://claude.ai/artifact/HoJBRPxPb1UF3vY7okToKJ. Ahí están los dibujos, la tabla de piezas, el mapa de patas y los modos de firmware.

### Los cinco subsistemas

1. **Base y riel.** Base de 300×220 mm, azulejo, placa de acero de 100×50×3 mm y riel con muescas cada 2.00 mm.
2. **Columna Z.** Perfil 2020 con tornillo M6 de 1 mm por vuelta y marcas de 0.1 mm; el cero lo da el toque eléctrico. Lleva una palanca con leva de 2.0 mm para arrancar el arco.
3. **Pluma.**
   - Resorte con escala, para dar una fuerza de contacto de 0–2 N (F = k·x).
   - Rueda de avance a mano y tubo PTFE.
   - Portapuntas de cobre M6 con punta MIG de 0.8.
   - Dos bobinas con núcleo de ferrita a unos 8 mm de la gota.
4. **Tarjeta de cabeza.**
   - Q3 (IRFB4227) con su driver TC4422 local.
   - Sensor Hall ACS758.
   - Cables Kelvin a la punta y a la placa.
   - Retorno de 20 cm en calibre 12 de Q3 a la placa.
5. **Caja de control.**
   - Río a 100 kHz con IR2110.
   - TVS de 100 V.
   - Pico 2.
   - Módulo de 48→12 V.
   - Puente H DRV8833 para las bobinas.
   - Ventilador y PARO.

### Patas del Pico

| pata | uso |
|---|---|
| GP16 | HIN (llave Q1) |
| GP17 | Q3 |
| GP14 | SD (paro) |
| GP26 | Hall |
| GP27 | Kelvin ÷16 |
| GP28 | V_bus ÷21 |
| GP29 | NTC de D1 |
| GP18–21 | bobinas |
| GP22 | gatillo |
| GP15 | LED de sincronía con la cámara |

### Etapas, cada una con su criterio de "pasa"

| etapa | qué se prueba |
|---|---|
| 0 · mecánica | Z, resorte y muescas |
| 1 · río | carga falsa; PARO |
| 2 · fusible | I²·t del Truper tubular, que reemplaza al del modelo |
| 3 · cabeza | R contra fuerza (Holm); sin satélites con Q3 |
| 4 · arco y campanazo | a tres corrientes de base |
| 5 · bobinas | barrido del instante de soltar → f₁ y Q₁; hexágono con la cabeza quieta |

### Modos del firmware

MONITOR, CERO, FUSIBLE, PUNTO, ARCO, CAMPANAZO y BARRIDO.

## 11. Banco mínimo de verdad (2026-11-04, pedido de ian)

ian: «Debe ser más primitivo… reducir el número de componentes a lo mínimo… primero mantener el arco y manejar el control de la temperatura hasta ver gota, luego intentar hacerla bailar. El carro Z, el driver, el Hall y las bobinas añaden complejidad.»

### Qué se queda

- La fuente de 48 V y la caja: río, Pico, sensor Hall dentro de la caja, PARO y buzzer.
- La **antorcha y el alimentador de la SOMI Truper**, si siguen existiendo (de esa soldadora salió la bobina de ~50 µH). Plan B: la pluma más el motor del extrusor de la impresora vieja.
- Un soporte impreso fijo para la antorcha.
- Placa sobre azulejo y una pinza de tierra.
- El celular con un vidrio de careta.

### Qué se va, por ahora

- **El carro Z.** El largo del arco lo sostiene el firmware en modo voltaje constante, como una MIG.
- **La tarjeta de cabeza, Q3 y los cables Kelvin.** Se usa Kelvin por software: se resta la caída del cable, medida al tocar la placa.
- **Las bobinas.** Para apuntar se probará la pinza de tierra como bobina gratis (0.8 mT a 1 cm del arco).

### La gota como su propia bobina

F = µ₀I²/4π da 4 % de la tensión superficial a 40 A y 100 % a 194 A. De esa igualdad sale el Icrit del modelo de junio. Para estirar la gota no hace falta bobina; para empujarla de lado hace falta asimetría (el retorno por la placa).

### Polaridad

El E71T-GS normalmente va en DCEN: alambre al negativo. Hay que confirmarlo en la etiqueta del carrete. Si es así, solo se intercambian los dos cables de salida.

### Pasos

Ninguno de los pasos 1 a 5 agrega piezas; todo es firmware sobre la misma caja.

1. Calibrar.
2. Mantener el arco en modo voltaje constante a 15–40 A. El voltaje cuenta la gota.
3. Controlar el calor hasta que la gota se suelte pareja.
4. Campanazo.
5. Bailar.

## 12. El paquete imprimible (2026-11-04)

ian se encarga del alimentador. El paquete son seis piezas paramétricas:

1. **La Torre**, en tres partes:
   - **1a · caja.** 225×124×~110 mm. Túnel de aire en el mismo sentido que la LRS (ventilador → disipador Q1+D1 → bobina) y repisa de señal arriba (Pico + IR2110, Hall, módulo 48→12 V).
   - **1b · tapa y frente.** PARO de 22 mm, salidas en tornillos M8 de latón con bujes impresos, USB y un GX12 para el gatillo y el alimentador.
   - **1c · falda con ventilas.** Va atornillada a los 8 M4 laterales de la LRS (M4×6 como máximo) y deja 10 mm de aire arriba de la fuente.
2. **La Garra.** Pie, poste con ranura M5 y abrazadera para la antorcha, a 60 mm o más del arco.
3. **La Mesa.** Marco para un azulejo de 200×200, clips para la placa de 100×50×3 y una cruz de referencia.
4. **El Ojo.** Marco para el vidrio de careta estándar (50.8×108 mm), soporte de celular y bisagra M5.
5. **El Calibre.** Alambre afuera a 5, 10 o 15 mm.
6. **Clips** de alivio de tensión.

### Reglas de diseño

- Ningún plástico a menos de 10 mm de la bobina o del disipador; la bobina va en una cuna de costillas.
- La corriente fuerte no pasa por plástico.
- Tuercas cautivas en lugar de insertos térmicos.
- Agujeros +0.2 mm, paredes de 3 mm, sin soportes.
- PETG o ASA.

### Cómo se modela en La Forja

- Bajo una orden (regla #0.7).
- Piezas de referencia para encajar.
- Generadores reutilizables: caja con postes y tuercas cautivas, rejilla de ventilas, abrazadera de cilindro y panel con recortes.
- Cada pieza como script paramétrico con el kernel OCCT en Node, que saca STL, STEP y plano.
- Renders en iangpu.

### Medidas que faltan

- diámetro del cuello de la antorcha;
- diámetro y largo de la bobina;
- diámetro y alto de los capacitores;
- medidas del disipador;
- tamaño del azulejo;
- cama de la impresora y filamento.

### Mecánica de la LRS (datasheet, ±1 mm)

- 225×124×41 mm.
- 8× M4 laterales; los tornillos entran 6 mm como máximo.
- 4× M4 abajo, a unos 150×42 mm.
- El aire corre a lo largo.

## 13. La SOMI existe y el alambre queda confirmado (fotos de ian, 2026-11-04)

**Alimentador.** La SOMI conserva el alimentador completo: motor con rodillo, brazo de presión con balero, perilla de tensión, guía de entrada y antorcha. Para el MVP **se queda armada como estación de alambre**; solo cambia la fuente de corriente.

**Alambre (caja Truper 13750 MICRO-1).**

- E71T-GS de 0.8 mm (0.030"), acero al bajo carbono, sin gas, 1 kg.
- Compatible con SOMI-130T, SOMI-130X y SOMU-200X.
- La caja dice: «soporta transferencia por corto circuito, globular, pulsada y axial».

**Polaridad.** Dentro del compartimento de alambre hay dos terminales de base roja y una zapata amarilla. Falta verificar a cuál va la antorcha y la calcomanía «GAS OUTPUT / GUN». Lo esperado es DCEN.

**Cambios al paquete:**

- **Garra:** para la antorcha de la SOMI. Falta el diámetro del cuello.
- **Salidas de la Torre:** un cable a la terminal de la antorcha dentro de la SOMI (con la fuente propia de la SOMI desconectada de ahí) y otro a la pinza de tierra.
- **Gatillo:** los dos hilos del gatillo también llegan al GX12 de la Torre, para que el Pico arranque y grabe al mismo tiempo.

## 14. Todo en La Forja: biblioteca, cableado como datos, órdenes (2026-11-04)

ian: «Quiero todo el diseño en La Forja, como en Fusion, que diseña el circuito incluido el cableado. Usaremos el alimentador completo como punta fija por ahora. Lo primero es mantener el arco, controlar la distancia y hacer lecturas, nada de chispas. Descarga los elementos que puedas y piensa en una manera sencilla de crear y organizar el cableado.»

**Control.** Son dos perillas:

- el alimentador (velocidad del alambre);
- el arco (corriente o voltaje de la Torre).

La distancia sale del voltaje del arco (14 + 10·gap V), con Kelvin por software. Primero va en modo voltaje constante con avance fijo, que se autorregula como una MIG; después, el avance entra al lazo. «Nada de chispas»: arco largo en globular a corriente baja, y si el voltaje cae abajo de 8 V (corto), la corriente no se dispara.

**Biblioteca (orden A, VERDE).** `models/step/banco-arco/` tiene 9 STEP con licencia y sus medidas exactas en `LEEME.md`.

### El cableado como datos

**Un solo archivo**, `cableado.json`, es la fuente única de verdad. Contiene:

- los componentes con sus **pines con nombre** (por ejemplo «Q1.D», «LRS.+V» o «TORRE.ANTORCHA»), con una posición 3D en la pieza;
- los **cables**: id, de, a, calibre, color, función, carril y conector;
- los **carriles**: las canaletas impresas de la caja, como polilíneas.

**La Forja genera:**

1. los cables en 3D (sweep por los carriles) dentro del ensamble;
2. el diagrama de cableado en 2D;
3. la hoja de corte, con el largo por carril + 10 % + terminales;
4. las etiquetas imprimibles para los dos extremos;
5. los chequeos: calibre contra corriente, potencia y señal separadas, y distancia a lo caliente.

**Las reglas físicas son primitivas:**

- **Tres cables:**
  - grueso: cal 8–10, potencia;
  - mediano: cal 18, 12 V y motor;
  - delgado: 24 AWG trenzado, señales.
- **Colores por función, no por polaridad:**
  - rojo: +48 V;
  - negro: −48 V y retorno;
  - naranja: antorcha;
  - verde: pinza;
  - azul: señal.
- **Etiquetas en los dos extremos:** P1… (potencia), A1… (auxiliar), S1… (señal).
- **Conector en cada frontera, para que todo se desenchufe:**
  - zapata de ojo en la potencia;
  - JST-XH en la señal;
  - GX12 hacia la SOMI (gatillo y motor).
- **Dos carriles que nunca corren juntos:** potencia abajo, en el túnel de aire, y señal arriba, en la repisa. Solo se cruzan a 90°.
- **Canaletas con peines y anclas para cinchos**, impresas como parte de la caja.

### Primera lista de cables (banco mínimo)

**Potencia:**

| cable | de → a | calibre | largo |
|---|---|---|---|
| P1 | LRS +V → F1 → bus+ | cal 10 | ~15 cm |
| P2 | LRS −V → estrella | cal 10 | ~15 cm |
| P3 | salida (bobina → Hall) → terminal de la antorcha en la SOMI | cal 8, naranja | ~2 m |
| P4 | estrella → pinza de tierra | cal 8, verde | ~2 m |

P5–P8 son los tramos internos (Q1, D1, bobina y Hall), rígidos y cortos, todos sobre el disipador.

**Auxiliar:**

| cable | de → a |
|---|---|
| A1 | 48 V → módulo de 12 V |
| A2 | 12 V → IR2110 y ventilador |
| A3 | driver del motor → GX12 → motor de la SOMI |

**Señal:**

| cable | de → a |
|---|---|
| S1 | GP16 → HIN |
| S2 | GP14 → SD y PARO |
| S3 | Hall → GP26 |
| S4 | V de salida → GP27 |
| S5 | V del bus → GP28 |
| S6 | gatillo → GX12 → GP22 |
| S7 | PWM del motor → driver |
| S8 | buzzer |

### Órdenes que siguen

- **B · ensamble real:**
  - STEP como componente de ensamble (hoy solo reemplaza el cuerpo principal);
  - giro en 3 ejes (rx, ry);
  - color y material por componente;
  - STL por pieza desde Node.
- **C · cableado como datos:** pines, `cableado.json`, sweep por carriles, hoja de corte, etiquetas y chequeos.
- **D · piezas del paquete:** caja, falda, frente, garra, mesa, ojo, calibre y clips.
