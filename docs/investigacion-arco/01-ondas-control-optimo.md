# 01 · «Millones de ondas»: qué forma de fuerza suelta la gota y qué compra la retroalimentación

Script: `scripts/investigacion-arco/01_ondas_control_optimo.py` · salida cruda: `scripts/investigacion-arco/01_ondas_control_optimo.out` (corrió en iangpu, 16 procesos, ~150 s; 332 casos × 300 gotas + gemelos).

## 1. La pregunta

Si el pellizco es ∝ I² y cualquier fuerza F(t) ≥ 0 se sintetiza con I = I_crit·√(F/F_σ), ¿qué FORMA de fuerza suelta mejor una gota del tamaño pedido, y qué gana el control con retroalimentación (el «oído») frente a 1, 2, 3, 5 o «millones» de ondas en lazo abierto?

## 2. La respuesta corta

- **La forma óptima no es un tono ni una suma de tonos: es bang-bang en fase con la VELOCIDAD de la gota** (cuadratura = el lente 𝔄). Razón exacta: ∫I²dt = I_crit²·∫s dt es *lineal* en s, y con s acotada el óptimo de Pontryagin vive en las esquinas. La corriente salta a I_max cuando la gota se estira hacia afuera y baja a I_min cuando regresa. El ancho de la ventana alta lo fija el canal de volumen (⟨I⟩ = 40 A para derretir): 180° con 10/70 A y 120° con 10/100 A.
- **Números (gota de 0.46 mm, Q = 30):**
  - el campanazo de hoy (40 ± 30 A senoidal, en fase perfecta) suelta en **6.05 ciclos**;
  - la cuadrada 10/70 A suelta en **4.10 ciclos**;
  - un pulso de 120° a 100 A, con la misma ⟨I⟩ = 41.9 A, suelta en **2.05 ciclos**.
  - Con Q = 10 y 70 A **nada** suelta, sea cual sea la forma. Con 100 A, el pulso de 120° suelta en 3.08 ciclos y la cuadrada en 2.04.
- **Monte Carlo** (0.6 m/min, 70 A, Q = 30; f₂ con 1 % de error por gota, avance ±10 %, residuo de la gota anterior):

  | estrategia | se sueltan | ciclos | σ del tamaño |
  |---|---|---|---|
  | **bang-bang con oído** | **100 %** | **4.8** | **3.2 µm** |
  | tono fijo | 91 % | 9.9 | 5.5 µm |
  | chirp a ciegas (canon) | 70 % | 8.1 | 8.1 µm |
  | multitono 5 | 68 % | 27 | 6.8 µm |
  | multitono 3 | 0 % | — | — |

  A 3 m/min los tonos fijos y los multitonos sueltan **0 %**; el bang-bang, 100 % con 5.4 µm.
- **La precisión de tamaño la limita el MAPA frecuencia → tamaño, no la forma de onda.**
  - Con oído perfecto, σ = 0.3–0.8 µm.
  - Con 1 % de error en f₂ por gota, 3.2 µm.
  - Con ±5 %, 9 µm. Eso le pasa a todo esquema que mida tamaño por frecuencia.
  - Arreglo: calibrar con la báscula gratis, que es el intervalo entre gotas por el avance del alambre.
- **«Millones de ondas» no compran control.**
  - La gota recibe 3–11 modos útiles × 2 números (amplitud y fase) por gota, más 2 de l=1 y 1 de volumen.
  - La forma de onda trae 25–3 700 números por gota; el resto es calor y armónicos.
  - Ejemplo: el 3er armónico de la cuadrada cae **exacto** en l=4 (f₄/f₂ = 3.000) y se lleva 10–18 % de la amplitud de l=2.
  - Lo que compra control es OÍR la fase y conmutar en el instante correcto: un solo bit por medio ciclo.
- **Lo crítico del firmware es calibrar la fase del oído.**
  - Con 30° de error, el bang-bang pasa de 4.8 a 6.45 ciclos; con 60° a 19.6 ciclos (sesgo de +40 µm); con 90° no suelta nada.
  - Hay literatura que reporta que el voltaje sube cuando la gota baja: el signo puede venir invertido.

## 3. Método

**Modelo de la gota (el del canon, sin cambios):**

  q'' + (ω/Q)·q' + ω²[1 − β·s]·q = ω²·s,  con s = (I/I_crit)², I_crit = 194 A, β = 1 (hallazgo del canon).

- Se suelta cuando q ≥ 1.
- ω² = (1+ε)²·8σ/(ρa³).
- La gota crece desde 0.30 mm con el alambre de 0.8 mm. Se probaron dos velocidades: 0.6 m/min (58.6 ms por gota, la del MC del canon) y 3 m/min (11.7 ms, la de `arcoFisica.ts`).
- Gota pedida: 0.460 mm (f₂ = 668 Hz sin carga, 645 Hz con β = 1 y 10/70 A).

**Actuador:** primer orden τ_c + pendiente limitada, ajustado a `canon_corriente.out` (ngspice).

| caso | modelo | ngspice (canon) |
|---|---|---|
| 20 kHz (τ = 150 µs) a 668 Hz | 25.4 A, 32.1° | 26.2 A, 31.8° |
| 20 kHz a 1268 Hz | 19.3 A, 49.9° | 20.3 A, 51.7° |
| 100 kHz (τ = 5 µs) | 30.0 A, 1–2° | 30.7–32 A, −1.7° |

Pendientes: sube (0.75·48 − 18.8 V)/41 µH = **0.42 A/µs** (con el tope de duty 0.75 en arco, no los 0.8 A/µs del duty pleno) y baja 0.47 A/µs.

**El oído:** y = −10 V/mm·a[mm]·q − 2·10 V/mm·a(t) + dR·(I − 40 A) + ruido.

- **El primer término (la señal):** la oscilación de la gota cambia el largo del arco.
- **El segundo término:** la gota crece y acorta el gap.
- **dR·(I − 40 A):** lo que sobra al restar R·I; dR = 1 mΩ.
- **El ruido:**
  - el del arco: 10 mV rms a 20 kS/s nominal, barrido 0.1, 0.3 y 1 V;
  - el del ADC del Pico: ENOB 9 con divisor /16, que da 29.8 mV por muestra cruda, promediada a la tasa del lazo.

El Pico estima la gota con un **EKF de 6 estados** [q, q'/ω, ln ω, m (avance real/nominal), b, ḃ]. La chirp de la campana se ata a la física: d ln ω/dt = −V̇/(2V), con V̇ = m·A_w·v_f. Así **el oído aprende el avance**.

**Mundos (Monte Carlo, 300 gotas por caso, mismas gotas para todas las estrategias):**
- **nom:** todo nominal.
- **cal:** f₂ real con 1 % de jitter por gota (material calibrado), avance ±10 %, residuo de la gota anterior q₀ ~ U[0, 0.3] con fase al azar (SUPUESTO: el retroceso al soltarse), dR 1 mΩ.
- **sin:** igual que cal, pero f₂ ±5 % por gota (sin calibrar).

**Estrategias.** En lazo abierto (el instante de arranque lo elige un gemelo con el modelo nominal):
- tono fijo a f₂(0.46 mm);
- multitono de 3 y de 5 tonos repartidos en ±5 %, con fases de Schroeder y el mismo pico de corriente;
- chirp a ciegas siguiendo el crecimiento nominal (el «ciegas» del canon);
- chirp con seno puro en s (I = I_crit·√s).

Con retroalimentación:
- **chirp + oído:** el método del canon; golpecitos de 10 A cada 4 ms, y el disparo cuando falta lo que tarda en sonar.
- **bombeo 2ω con retroalimentación:** s alta cuando (q − q_c)·q' > 0, que conmuta a 2ω.
- **bang-bang en fase con v (bb_v):**
  - mientras escucha, un piloto a 25/55 A mantiene la campana sonando a |z| ≈ 0.15;
  - dispara cuando t + T_carga(|z|) ≥ t̂*;
  - después conmuta 10↔I_max con el signo de la velocidad estimada, adelantada τ_lead (160 µs a 20 kHz, 75 µs a 100 kHz).
- **bang-bang + fase (bb_z):** el lente 𝔄 en sus dos ejes. Mientras la amplitud es chica, el piloto empuja *en fase con q* para girar la fase de la gota (ahí la autoridad es grande). Así, después de cargar a tope en cuadratura, el pico que la suelta cae en t̂*.
- **Cotas `*`:** las mismas leyes con «oído perfecto»; el controlador ve la gota real.

**Partes analíticas:**
- **2a, armónicos:** FFT de s(t) por forma de onda, con la respuesta estacionaria de l=3 y l=4. Acople c_l = 1 (cota alta) y Q_l escalado con la viscosidad de Lamb: Q₃ = 0.69·Q₂, Q₄ = 0.56·Q₂.
- **2b, apuntar:** el modelo de `apuntar2.py` con la corriente multiplicando al campo.
- **2c, cuello:** l=3 con un criterio de desprendimiento SUPUESTO, q₂ + κ·q₃ ≥ 1.
- **3, grados de libertad:**
  - tabla por modo l = 2…30, con pendiente, ancho de banda del lazo y ruido;
  - SVD de la alcanzabilidad lineal;
  - 2BT de la forma de onda.

**Lo que NO está en el modelo:**
- el desprendimiento no lineal (cuello real);
- la no-linealidad de amplitud grande (la frecuencia baja algunos % a q ~ 0.5; eso le pega al lazo abierto y no al bang-bang, que sigue la fase);
- el arc blow;
- que la gota colgada de un alambre de 0.8 mm (r_w/a = 0.87) no es la gota libre de Rayleigh. Strani & Sabetta (1984) muestran que el soporte cambia las frecuencias y crea un modo extra. **Las razones 1.94 y 3.00 son de la gota LIBRE.**

## 4. Resultados

### 4.1 La forma de la fuerza (gota fija de 0.46 mm, en fase perfecta, actuador ideal, β = 1)

`F1` = componente de s a la frecuencia de la gota (lo único que la gota «oye»). `⟨I⟩` = lo que derrite.

| Q | I_max | forma | F1 | ciclos | ⟨I⟩ A | ⟨I²⟩/40² |
|---|---|---|---|---|---|---|
| 30 | 70 | tono en I 40 ± 30 (el campanazo) | 0.0638 | **6.05** | 40.3 | 1.30 |
| 30 | 70 | seno puro en s (I = I_crit√s) | 0.0638 | 6.08 | 46.0 | 1.58 |
| 30 | 70 | ventana 90° | 0.0574 | 7.12 | 25.3 | 0.83 |
| 30 | 70 | ventana 120° | 0.0703 | 5.11 | 30.6 | 1.09 |
| 30 | 70 | **ventana 180° (cuadrada)** | 0.0812 | **4.10** | 40.7 | 1.60 |
| 30 | 100 | tono 55 ± 45 | 0.1315 | 1.99 | **55.8** | 2.61 |
| 30 | 100 | **ventana 120°** | 0.1450 | **2.05** | **41.9** | 2.26 |
| 30 | 100 | ventana 180° | 0.1675 | 2.00 | 54.8 | 3.14 |
| 10 | 70 | cualquiera (tono, seno, ventanas) | ≤ 0.081 | **nunca** | — | — |
| 10 | 100 | tono 55 ± 45 | 0.1315 | 3.01 | 55.7 | 2.60 |
| 10 | 100 | **ventana 120°** | 0.1450 | **3.08** | **41.4** | 2.22 |
| 10 | 100 | ventana 180° | 0.1675 | 2.04 | 55.7 | 3.20 |

Lectura:
- **A la misma ⟨I⟩ (lo que derrite), el pulso centrado en el pico de velocidad le gana al tono:**
  - con 70 A, 4.10 contra 6.05 ciclos;
  - con 100 A, el pulso de 120° iguala al tono de 100 A (2.05 contra 1.99 ciclos) sin subir ⟨I⟩ de 42 a 56 A.
- **El seno puro en s cuesta lo mismo en F1 y sube ⟨I⟩ 6 A.** Solo vale por limpieza espectral (§4.4).
- **Con Q = 10, la única salida es subir I_max:** el umbral para la cuadrada es ~75 A.

### 4.2 Monte Carlo principal (lazo de hoy, 20 kHz). Tabla completa en el `.out`

**0.6 m/min, I_max 70 A, Q = 30, mundo cal** (f₂ 1 % por gota). ∫ = energía de pellizco extra sobre 40 A fijos, en A²·ms, en toda la vida de la gota; σ_t = dispersión del instante de soltar contra lo planeado.

| estrategia | % suelta | ciclos | error medio µm | σ µm | P95 µm | ∫(I²−40²) | σ_t µs |
|---|---|---|---|---|---|---|---|
| tono fijo (campanazo) | 90.7 | 9.87 | +6.8 | 5.5 | 17.7 | 5 135 | 4 501 |
| multitono 3 (±5 %) | 0 | — | — | — | — | — | — |
| multitono 5 (±5 %) | 67.7 | 26.9 | +6.4 | 6.8 | 14.9 | 9 549 | 6 555 |
| chirp a ciegas (canon) | 70.3 | 8.09 | +3.3 | 8.1 | 18.9 | 4 145 | 1 408 |
| chirp, seno en s | 73.7 | 7.79 | +1.7 | 7.9 | 16.0 | 9 117 | 1 003 |
| chirp + oído (canon) | 100 | 7.72 | +0.1 | 3.6 | 6.9 | 4 193 | 825 |
| bombeo 2ω con retroalim. (puro: s alta si (q−q_c)·q' > 0) | **0** | — | — | — | — | — | — |
| **bang-bang en fase con v** | **100** | **4.82** | −0.6 | **3.2** | 6.0 | 9 566 | 440 |
| **bang-bang + fase (𝔄)** | **100** | 5.07 | −0.8 | **3.2** | 6.0 | 9 784 | **251** |
| bang-bang v, oído perfecto | 100 | 4.84 | −0.1 | 0.8 | 1.4 | 9 778 | 408 |
| bang-bang + fase, oído perfecto | 100 | 5.06 | −0.4 | **0.3** | 0.4 | 12 922 | 116 |

**Resumen % suelta / σ (µm)**, a 20 kHz:

| | Q5 cal | Q10 cal | Q30 cal | Q30 sin (±5 %) |
|---|---|---|---|---|
| **0.6 m/min, 70 A** | | | | |
| tono fijo | 0 % | 0 % | 91 % / 5.5 | 86 % / 8.6 |
| chirp a ciegas | 0 % | 0 % | 70 % / 8.1 | 60 % / 10.0 |
| chirp + oído | 0 % | 0 % | 100 % / 3.6 | 100 % / 9.3 |
| bang-bang v | 0 % | 0 % | 100 % / 3.2 | 100 % / 9.1 |
| **0.6 m/min, 100 A** | | | | |
| tono fijo | 0 % | 98 % / 10.2 | 100 % / 12.8 | 100 % / 11.8 |
| chirp + oído | 0 % | 100 % / 3.1 | 100 % / 3.4 | 100 % / 9.0 |
| bang-bang v | **100 % / 4.3** (sesgo −17 µm) | 100 % / 3.2 | 100 % / 3.2 | 100 % / 9.0 |
| **3 m/min, 70 A** | | | | |
| tono fijo, multitono 3 y 5 | 0 % | 0 % | **0 %** | 0 % |
| chirp a ciegas | 0 % | 0 % | 78 % / 17.3 | 61 % / 17.7 |
| chirp + oído | 0 % | 0 % | 100 % / 16.5 | 100 % / 18.3 |
| bang-bang v | 0 % | 0 % | **100 % / 5.4** | 100 % / 9.2 |
| bang-bang + fase, oído perfecto | 0 % | 0 % | 100 % / 1.2 | 100 % / 0.9 |
| **3 m/min, 100 A** | | | | |
| chirp + oído | 0 % | 100 % / 8.2 | 100 % / 7.8 | 100 % / 10.9 |
| bang-bang + fase | 100 % / 12.6 | 100 % / 3.7 | 100 % / 3.5 | 100 % / 8.9 |

Lectura:
1. **El tono fijo muere cuando la gota crece rápido:** a 3 m/min pasa por la resonancia en ~2 ms, menos de lo que tarda en sonar. Los multitonos reparten el pico y cada tono queda débil:
   - el de 3 tonos no suelta ni en el mundo nominal;
   - el de 5 tarda 27 ciclos.
2. **La retroalimentación compra «se suelta siempre y en menos ciclos»** (100 % contra 60–91 %; 4.8 contra 8–10 ciclos). Además funciona con Q = 5 a 100 A, donde ningún esquema en lazo abierto suelta nada. El costo es que el piloto de escucha sube ∫(I²−40²) de ~4 000 a ~9 600 A²·ms por gota: +10 % sobre los 94 000 A²·ms de los 40 A de base; ⟨I⟩ sigue en 40 A.
3. **El tamaño lo limita el mapa f → a, no la forma de onda.** Con oído perfecto, σ = 0.3–0.8 µm; con 1 % de error en f₂ por gota, 3.2 µm, que es (2/3)·1 % de 460 µm; con ±5 %, 9 µm, para TODOS los esquemas con oído. La retroalimentación no corrige lo que el oído no ve.
4. **La fase preajustada (bb_z) solo paga cuando el oído es bueno:**
   - con oído perfecto a 3 m/min: σ 1.2 contra 3.8 µm del bb_v;
   - con el oído real a 20 kHz empata con bb_v;
   - lo que sí da siempre es σ_t: 251 µs contra 440 µs, que es lo que pide apuntar.

### 4.3 Lazo, ruido, Q mal calibrado, fase mal calibrada (mundo cal, 70 A)

**Lazo de 100 kHz contra 20 kHz (Q = 30):**
- bb_v baja de 4.82 a 3.87 ciclos (0.6 m/min) y de 4.79 a 3.79 (3 m/min); el σ del tamaño no cambia (3.3 y 5.3 µm).
- El chirp a ciegas sube de 70 a 84 % de gotas que se sueltan.
- Con Q = 10 a 3 m/min, solo bb_v a 100 kHz suelta (11.6 ciclos, sesgo +39 µm).

**Ruido del oído (Q = 30):**

| ruido rms (20 kS/s) | bb_v 0.6 m/min: σ / sesgo | bb_v 3 m/min: σ / sesgo | chirp + oído 3 m/min |
|---|---|---|---|
| 10 mV | 3.2 / −0.6 µm | 5.4 / +0.6 µm | 100 %, +4 ± 16.5 µm |
| 100 mV | 3.2 / −0.4 | 8.3 / +3.5 | 97 %, +46 ± 29 |
| 300 mV | 3.2 / −0.3 | 12.8 / **+48** | 42 % |
| 1 V | 4.0 / −0.6 | 15.5 / **+86** | 4 % |

A 0.6 m/min el oído aguanta hasta 1 V. A 3 m/min necesita ≤ 100 mV, porque la gota vive 11.7 ms y no da tiempo de aprender su frecuencia.

**Q mal calibrado** (el Pico cree 20 o 45; el real es 30): sesgo de −4 / +2 µm a 0.6 m/min y de −23 / +8 µm a 3 m/min. Hay que medir Q (con el decaimiento del piloto) a ±20 %.

**Fase del oído mal calibrada** (`.out` §1g, bb_v, Q = 30):

| error de fase | 0.6 m/min: % suelta / ciclos / sesgo | 3 m/min: % suelta / ciclos / sesgo |
|---|---|---|
| 0° | 100 % / 4.82 / −0.6 µm | 100 % / 4.79 / +0.6 µm |
| 30° | 100 % / 6.45 / +4.0 µm | 100 % / 6.12 / +18.7 µm |
| 60° | 96 % / 19.6 / +40.5 µm | 5 % / 13.1 / +123 µm |
| 90° | **0 %** | **0 %** |

Es el parámetro más sensible del firmware: un oído con el signo invertido (180°) frena la gota en vez de bombearla.

**Bombeo 2ω puro con retroalimentación** (`.out` §1 y §1f):
- **A 70 A, con β = 1:** 0 % en todos los mundos, Q y velocidades.
- **A 100 A, Q = 30 y 0.6 m/min:** 100 %, pero en 7.8 ciclos y con sesgo de +17 µm; bb_v suelta en 1.8 ciclos con +0.3 µm. A 3 m/min, el sesgo es de +64 µm.
- **Con β = 2, Q = 30 y 70 A:** 97 % en 18 ciclos y +37 µm a 0.6 m/min; 4 % a 3 m/min.

Retroalimentar arregla la lengua (la fase), pero no la ganancia.

### 4.4 Multimodo con UNA corriente

**Armónicos de s y fuga a l=3 y l=4** (c_l = 1, cota alta; f₂ efectiva 645 Hz):

| forma (10/70 A) | ⟨I⟩ | ⟨I²⟩ | s₂/s₁ | s₃/s₁ | q₃/q₂ (2ω, a +3.3 % de f₃) | q₄/q₂ (3ω, EXACTO en f₄) |
|---|---|---|---|---|---|---|
| tono en I 40 ± 30 | 40.0 | 2 050 | 0.188 | 0 | 0.075 | 0 |
| seno puro en s | 45.9 | 2 500 | 0 | 0 | **0** | **0** |
| cuadrada ideal | 40.0 | 2 500 | 0 | 0.333 | 0 | **0.185** |
| ventana 120° | 30.0 | 1 701 | 0.500 | 0.001 | **0.200** | 0 |
| cuadrada real, lazo 20 kHz | 40.0 | 2 155 | 0.143 | 0.187 | 0.057 | 0.104 |
| cuadrada real, lazo 100 kHz | 39.7 | 2 370 | 0.084 | 0.297 | 0.033 | 0.165 |

**El actuador I² mezcla canales, como predice el marco:**
- el tono ensucia l=3 con su 2ω;
- la cuadrada ensucia l=4 con su 3ω, porque f₄/f₂ = 3.000 exacto en la gota libre;
- la ventana de 120° ensucia l=3.

El seno puro en s es el único limpio, y cuesta 27 % de F1 y +6 A de ⟨I⟩. Si l=4 resultara dañino (satélites), una ventana de 120° quita el 3ω y una de 180° quita el 2ω: se escoge qué modo ensuciar.

**Volumen (l=0) + soltar (l=2) con una corriente: sí caben.** El ancho de la ventana fija ⟨I⟩ (volumen) y su fase fija el bombeo (soltar). Son dos números independientes de la misma onda. La fuga real va por ⟨I²⟩ (calentamiento del stickout): la cuadrada lo sube 56 % sobre 40 A de CD.

**Apuntar (l=1, B × I) mientras se suelta (l=2)** (modelo de `apuntar2.py`, f₁ = 0.5·f₂ SUPUESTO, blanco a 0.5 mm):

| política | error de apuntar debido al cruce | requisito |
|---|---|---|
| simultáneo, sin compensar | **185 µm** medio, 90 % < 216 µm | — |
| simultáneo, B(t) = B_plan·40/I(t) | 0 por construcción | B pico **13.9 mT** (×4) y bobina de ~1.9 kHz |
| secuencial (patada, luego B = 0 y suena l=2) | **0** | B₀ = 4.59 mT (contra 3.47) |

Lo que de verdad decide apuntar es otra cosa: soltar 1 µs tarde mueve la caída **0.99 µm**. Para errar < 100 µm hay que conocer el instante de soltar a < **100 µs**.

| esquema (Q = 30, mundo cal, 20 kHz) | σ_t | error de apuntar resultante |
|---|---|---|
| tono fijo | 4 500 µs | 4.4 mm |
| chirp + oído | 825 µs | 0.8 mm |
| bb_v | 440 µs | 0.44 mm |
| bb_z | 251 µs | 0.25 mm |
| bb_z con oído perfecto | 116 µs | 0.11 mm |

Es decir, apuntar exige el bang-bang con fase Y un oído mejor que el de hoy.

**El modo l=3 para «estrangular el cuello»** (criterio SUPUESTO q₂ + κ·q₃ ≥ 1; gota fija, Q₂ = 30, 70 A; ciclos de l=2):

| c₃ | κ | solo l=2 (ley A) | dos modos (ley B: signo de Σ κ_l c_l ω_l p_l/A_l) | tono a f₃ solo |
|---|---|---|---|---|
| 0.5 | 0 – 0.5 | 4.11 – 4.12 | 4.11 – 4.12 | nunca |
| 0.5 | 1 | 4.10 | 3.77 | nunca |
| 1 | 0.5 | 4.10 | 3.77 | nunca |
| 1 | 1 | 4.09 | **2.63** | 4.23 |

l=3 solo ayuda si su acople al desprendimiento es fuerte (κ·c₃ ≥ 0.5). La ley óptima de varios modos es UNA conmutación sobre una suma pesada de velocidades modales; no es sumar tonos.

### 4.5 ¿Qué compran «millones de ondas»?

**Por modo** (amplitud de corriente limitada por pendiente y lazo; q_max con c_l = 1; ruido a 20 kS/s). Un modo es «útil» si q_max ≥ 0.1 y señal/ruido ≥ 10.

| | 20 kHz, 10 mV | 20 kHz, 0.3 V | 20 kHz, 1 V | 100 kHz, 10 mV | 100 kHz, 0.3 V | 100 kHz, 1 V |
|---|---|---|---|---|---|---|
| Q₂ = 10 | 3 | 2 | 1 | 6 | 3 | 1 |
| Q₂ = 30 | 5 | 4 | 3 | 11 | 6 | 4 |

Ejemplos, con Q₂ = 30 y T = 11.7 ms:

| modo | frecuencia | 20 kHz | 100 kHz |
|---|---|---|---|
| l=2 | 668 Hz | q_max 0.91 | q_max 1.07 |
| l=5 | 2.8 kHz | 0.26 (8.5 A) | 0.72 (23.8 A) |
| l=10 | 7.8 kHz | 0.02 | 0.16 |
| l=20 | 21.6 kHz | 0.002 | 0.03 |

**SVD de la alcanzabilidad lineal** (cota alta: solo energía, sin el tope de pico ni la pendiente): semiejes ≥ 0.1.

| | c_l = 1 | c_l = e^{−(l−2)/2} |
|---|---|---|
| 20 kHz | 17 – 36 | 6 – 10 |
| 100 kHz | 27 – 50 | 10 – 16 |

**Números por gota en la forma de onda (2BT):**

| | 3 m/min | 0.6 m/min |
|---|---|---|
| lazo de 20 kHz (B = 1.06 kHz) | 25 | 124 |
| 100 kHz, señal chica | 746 | 3 731 |
| PWM a 100 kHz y 75 gotas/s | 1 333 ciclos de trabajo por gota | |

**Conclusión:**
- Los grados de libertad que llegan a la gota y se oyen son 2 × (3–11 modos) + 2 (l=1) + 1 (volumen), unos **9–25 números por gota**.
- Los que hoy sirven para el trabajo son **5**: ⟨I⟩, el cuándo y el cuánto de l=2, y el x,y de l=1.
- El resto de la forma de onda se filtra en el espacio nulo de la gota: calor en el stickout y armónicos que ensucian modos.
- «Millones de ondas» tiene sentido en UN solo lugar: la cuadrada del bang-bang ES una suma infinita de armónicos impares, y la escoge la retroalimentación, no un diseño de espectro.

### 4.6 Telemetría cruda (una gota, bb_z, 3 m/min, Q = 30, lazo 20 kHz; extracto del `.out`)

```
 t ms | a real | a que oye el Pico | q      | |z| est | I      | disparó | t* estimado
 0.00 | 0.3000 | 0.3000            | +0.002 | 0.032   | 39.5 A | --      | 11.72
 2.00 | 0.3388 | 0.3375            | +0.029 | 0.034   | 54.8 A | --      | 12.78
 4.50 | 0.3773 | 0.3779            | +0.061 | 0.016   | 52.1 A | --      | 11.66
 5.00 | 0.3841 | 0.3844            | +0.094 | 0.054   | 32.1 A | SI      | 11.75
 6.00 | 0.3971 | 0.3937            | +0.279 | 0.248   | 50.8 A | SI      | 12.52
 8.50 | 0.4263 | 0.4246            | +0.502 | 0.607   | 69.2 A | SI      | 12.06
10.00 | 0.4420 | 0.4410            | +0.823 | 0.805   | 51.2 A | SI      | 11.95
→ suelta en 11.49 ms con 0.4566 mm (ε +0.47 %, avance ×0.989)
```

El oído sigue el tamaño a ±0.003 mm desde los 4 ms. Lo que se mueve es t* (±0.5 ms), porque el avance real se aprende tarde. Ese es el cuello a 3 m/min.

## 5. Veredictos

| # | hipótesis | veredicto | número que lo decide | medición que lo decidiría en el banco |
|---|---|---|---|---|
| H1 | Más ondas (2, 3, 5 tonos) sueltan mejor o más robusto ante f₂ incierta | **FALSA** | multitono 3: 0 % aun en el mundo nominal; multitono 5: 55–68 % en 27 ciclos; 0 % a 3 m/min | barrido de ventanas multitono contra tono: contar gotas sueltas por cada 100 ráfagas |
| H2 | Chirp que sigue el crecimiento, a ciegas | **FALSA** como solución (sirve de respaldo) | 60–78 % se sueltan; σ 8–17 µm; 0 % con Q ≤ 10 a 70 A | lo mismo, en A/B contra bb_v |
| H3 | Bombeo 2ω CON retroalimentación (la fase ya no es problema) | **FALSA**: el problema era la ganancia, no la fase | ganancia paramétrica h·ω/4, con h = β·(2/π)·Δs = 0.081 para la cuadrada 10/70 A (0.069 tras el lazo de 20 kHz), contra amortiguamiento ω/(2Q): empatan en Q ≈ 25–29; con el tono del canon (h = 0.064), en Q ≈ 31. Con Q = 30 apenas hay ganancia neta. MC: 0 % a 70 A; a 100 A, 7.8 ciclos y +17 µm, contra 1.8 ciclos del bb_v; con β = 2, 18 ciclos | medir β con dos corrientes base (30 y 50 A): si f baja ≥ 4 %, β ≥ 2 y vale reabrir |
| H4 | Bang-bang en fase con la velocidad, con oído (cuadratura, lente 𝔄) | **PASA** (en el modelo) | 100 % se sueltan en 4.8 ciclos (Q = 30, 70 A), 2.3 ciclos (Q = 10, 100 A), 6.3 ciclos (Q = 5, 100 A, con sesgo −17 µm); aguanta 1 V de ruido a 0.6 m/min | A/B del §7 |
| H5 | Fase preajustada (𝔄 en los dos ejes) aterriza el pico en t* | **PASA con oído perfecto** (σ 0.3 µm, σ_t 116 µs); **INCIERTO** con el oído real a 20 kHz (empata con bb_v; σ_t 251 µs) | — | σ de los intervalos entre gotas con bb_z contra bb_v |
| H6 | La precisión de tamaño mejora con más control de onda | **FALSA**: la limita el mapa f → a | σ 0.3–0.8 µm con oído perfecto; 3.2 µm con 1 % en f₂; 9 µm con ±5 % | pesar 100 gotas (o el intervalo entre gotas) contra lo que dijo el oído |
| H7 | Volumen + soltar con UNA corriente | **PASA** | ancho de ventana → ⟨I⟩; fase → soltar; 120° a 100 A = 41.9 A y 2.05 ciclos | — |
| H8 | Apuntar (l=1) mientras se suelta, con la misma corriente | **FALSA** simultáneo sin compensar (185 µm); **INCIERTO** secuencial | pide σ_t < 100 µs; hoy 250–440 µs | foto de dónde caen 50 gotas con patada fija |
| H9 | l=3 «estrangula el cuello» y suelta más limpio | **INCIERTO** (el modelo no tiene cuello) | solo ayuda si κ·c₃ ≥ 0.5 (de 4.1 a 3.8 y a 2.6 ciclos) | lengua en f₃: un tono a 1.94·f₂ que suelte gotas ⇒ κ·c₃ grande |
| H10 | «Millones de ondas» compran control | **FALSA** | 9–25 números útiles por gota, contra 25–3 700 en la onda y 10⁵/s de PWM | — |

## 6. Qué cambia

**Firmware** (quita el campanazo de tono fijo y pon «oído + bang-bang»). Pico 2 / RP2350; núcleo 1 en el ISR del PWM (20 kHz hoy, 100 kHz meta), núcleo 0 a 1 kHz.

```c
// ISR del PWM (cada periodo). ADC por DMA en round-robin I (ACS758) y V (divisor /16), promedio de las muestras del periodo
y   = V - R_hat*I - L_hat*dIdt - V0_hat;          // R, L, V0 por RLS lento (rechaza la banda de la gota)
ekf_predict(s = (I/ICRIT)^2);                      // [q, p, lnw, m, b, bdot]; d lnw/dt = -m*Aw*vf/(2*V(lnw))
ekf_update(y);                                     // ~400 flops a 6x6; o ganancia fija tabulada por w (~40 flops)
z  = (q - qc(s_ema)) + i*p;                        // qc del promedio lento de s (NO supuesto: si no, el piloto se sesga)
zp = z * exp(-i*(w*TAU_LEAD + FASE_OIDO));         // adelanto del lazo + fase calibrada del oído
switch (modo) {
  case ESCUCHA:  // piloto 25/55 A: |z| -> 0.15 y la fase que aterriza el pico en t*
    Iref = (Im(zref_piloto - zp) > 0) ? 55 : 25;
    if (conf && t >= tstar - Tcarga(|z|) - 0.3*T) modo = DISPARO;  break;
  case DISPARO:  // bang-bang en cuadratura (lente A)
    Iref = (Im(zp) > cos(VENTANA/2)*|zp|) ? IMAX : IMIN;   // VENTANA = 180° con 70 A; 120° con 100 A (<I> = 40 A)
    break;
}
if (V salta > +4 V en < 50 us) { gota_suelta(); modo = ESCUCHA; ekf_reset(a = 0.30 mm); }
// núcleo 0 (1 kHz): tstar = t + (V* - V_hat)/(m_hat*Aw*vf); Tcarga = (2Q/w)*ln((Ass-|z|)/(Ass-Aend)); registro por USB
```

- **Calibraciones** (en este orden; sin ellas no sirve):
  1. **Signo y fase del oído:** con el piloto, barrer `FASE_OIDO` de 0 a 360° en pasos de 30° y quedarse con la que hace crecer |z| más rápido.
  2. **Q:** con el decaimiento de |z| al apagar el piloto; tiene que quedar a ±20 %.
  3. **β:** con f a 30 y a 50 A de base.
  4. **ε (el mapa f → a), con la báscula gratis:** volumen por gota = A_w·v_f·(intervalo entre saltos de V). Se corrige ε̂ cada ~100 gotas.
- **Respaldo:** si `conf` no llega (ruido > 300 mV a 3 m/min), cae al chirp + oído del canon.

**Circuito:**
- Si se quiere Q ≤ 10 o soltar en 2–3 ciclos, **I_max = 100 A** con ventana de 120°. Hay que:
  - verificar que el ACS758 sea de ≥ 150 A (versión 150B o 200B; un 50B se satura);
  - confirmar los MOSFET: el IRFB4227 da 65 A continuos e I_DM de 260 A (datasheet de IR; el número de parte real sigue sin confirmar).
- El choque de núcleo de aire no se satura.
- La LRS-1200 entrega los picos de 2 kW desde los 4 400 µF: 0.6 J por medio ciclo, ΔV ≈ 2.8 V.
- **El lazo de 100 kHz:** quita ~1 ciclo por gota y hace posible Q = 10 a 3 m/min; no es urgente para la prueba.
- **Las bobinas X/Y de l=1 se posponen:** apuntar no tiene caso hasta que σ_t < 100 µs.
- **NO se agrega** nada para multitono ni para l=3.

## 7. El experimento más barato que lo decide

**Paso 0 (sin arco, horas): banco con gemelo.** El núcleo 1 del Pico corre la gota simulada (este modelo) y el lazo real de corriente maneja una carga ficticia (resistencia de potencia + el choque). Esto valida la latencia, τ_lead y la ley de conmutación con la corriente real.
- Predicción: bb_v suelta la gota virtual en 4.8 ± 0.3 ciclos.
- Si el retraso real de I(t) contra Iref se aparta del τ_lead supuesto (160 µs a 20 kHz) en más de ~130 µs, eso ya son 30° a 645 Hz y el número sube a ≥ 6.45 ciclos.
- Ese retraso se mide aquí y se mete en τ_lead.

**Paso 1 (con arco a 40 A, la Pluma armada): A/B por gota alternada, en el mismo banco y la misma placa.**
- **A:** el campanazo del canon (chirp 40 ± 30 A a ciegas).
- **B:** bang-bang 10/70 A con oído.

Se registra V(t) a 500 kS/s. Por gota:
- los ciclos desde el disparo hasta el salto de V;
- si se soltó antes de 12 ciclos;
- el intervalo entre gotas (la báscula: σ_T/T = 3σ_a/a).

**Antes del A/B**, 100 golpecitos para medir f₂, Q, el ruido y la fase del oído. Es el criterio del canon, ampliado:
- **si Q ≥ 25 y ruido ≤ 300 mV:** se corre el A/B a 70 A;
- **si Q ≈ 10:** a 70 A nada suelta (predicción dura, para cualquier esquema); se sube a 100 A.

Predicciones del modelo (0.6 m/min, Q = 30, 70 A, 20 kHz, mundo cal):

| | se sueltan | ciclos | σ del intervalo entre gotas |
|---|---|---|---|
| A (chirp a ciegas) | 70 % | 8.1 | ~5 % (σ_a 8 µm) |
| B (bb_v) | 100 % | 4.8 | ~2 % (σ_a 3.2 µm) |
| B con Q ≈ 10 y 100 A | 100 % | 2.3 | — |

- **Si es cierto:** B suelta todas las gotas en ≤ 6 ciclos y con al menos 2 ciclos menos que A.
- **Si es falso:** B no le gana a A, o necesita > 8 ciclos. Entonces la fase del oído no es utilizable (el voltaje no sigue a q con una fase estable, o el ruido es > 1 V a 0.6 m/min) y el control se queda en lazo abierto con el chirp + oído del canon.
- **Barato también, en el mismo registro (decide H9):** un tono a 1.94·f₂ con 40 ± 30 A. Si suelta gotas, l=3 tiene acople fuerte. Si no, se descarta.

## 8. Fuentes

- **Zhang, Y.M., E, L., Kovacevic, R.** (1998). *Active metal transfer control by monitoring excited droplet oscillation*. Welding Journal 77(9), 388-s–395-s. Excitan la oscilación bajando la corriente y sueltan en la fase elegida: es el antecedente directo del oído + disparo en fase. https://scholars.uky.edu/en/publications/active-metal-transfer-control-by-monitoring-excited-droplet-oscil/ · Patente US 6,013,896: https://patentimages.storage.googleapis.com/90/2e/f8/e8c1abd03c1a76/US6013896.pdf
- **Xiao, J., Zhang, G.J., Zhang, W.J., Zhang, Y.M.** (2014). *Active metal transfer control by utilizing enhanced droplet oscillation, Part 1*. Welding Journal 93(8), 282s–291s. La corriente pico para soltar queda muy por debajo de la de transición; la fase de excitación y la de desprendimiento son los parámetros clave (no verifiqué el texto completo, solo el resumen). https://scholars.uky.edu/en/publications/active-metal-transfer-control-by-utilizing-enhanced-droplet-oscil-2/
- **Medición del tamaño de gota por la frecuencia del voltaje del arco al excitar la oscilación** (J. Manufacturing Processes, 2023). Reportan que el voltaje BAJA cuando la gota sube; el mecanismo no está entendido. De ahí la calibración de signo y fase del oído. https://scholar.hit.edu.cn/en/publications/online-measurement-of-droplet-size-by-actively-exciting-droplet-o/
- **Strani, M., Sabetta, F.** (1984). *Free vibrations of a drop in partial contact with a solid support*. J. Fluid Mech. 141, 233–247. La gota soportada tiene frecuencias distintas a las de Rayleigh y un modo extra: f₃/f₂ = 1.94 y f₄/f₂ = 3.00 son de la gota libre. https://scilit.com/publications/1621636b2d33e9d17842f5a6570a5341
- **Fajans, J., Friedland, L.** (2001). *Autoresonant (nonstationary) excitation of pendulums, Plutinos, plasmas, and other nonlinear oscillators*. Am. J. Phys. 69(10), 1096–1102. Es la teoría del chirp que «sigue» a un oscilador; tiene umbral de amplitud. https://physics.berkeley.edu/sites/default/files/autopendajp.pdf
- **RP2350 (Pico 2), ADC:** 12 bits, 500 kS/s; el datasheet cita ~9 ENOB y hay mediciones comunitarias más bajas (por eso se barrió el ruido). https://github.com/earlephilhower/arduino-pico/discussions/2763
- **IRFB4227:** 65 A continuos e I_DM 260 A (datasheet de International Rectifier, PD-97035A). https://dtsheet.com/model/2070315
- **De memoria, sin verificar aquí:**
  - el principio del máximo de Pontryagin para el bang-bang con control acotado y costo lineal;
  - la escala viscosa de Lamb, con tasa ∝ (l−1)(2l+1)ν/a².
- **Del canon, sin cambios:** `scripts/canon/canon_gota.py`, `canales_gota.py`, `apuntar2.py` y `canon_corriente.py`, con sus `.out`.
