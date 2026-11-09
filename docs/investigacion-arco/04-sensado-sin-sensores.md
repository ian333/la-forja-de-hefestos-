# 04 · Sensado sin sensores: contacto, distancia, temperatura y tamaño de gota con solo V e I

Script: `scripts/investigacion-arco/04_sensado_sin_sensores.py`. Su salida cruda está en `04_sensado_sin_sensores.out`, y todos los números de este reporte salen de ahí. Corre en unos 16 s en la laptop.

## 1. La pregunta

¿Qué puede saber el Pico 2 del contacto, la distancia, la temperatura y el tamaño de la gota leyendo solo V_out e I (el Hall), con su ADC de 12 bits y 500 kS/s, sin sensores extra? ¿Con qué precisión y con qué latencia?

## 2. Respuesta corta

- **Contacto: PASA.**
  - Toque: se detecta en 11 µs (mediana) desde que el contacto ya conduce, y en 26 µs (p95 116 µs) desde que el alambre toca, contando el «fritado» del óxido.
  - Corto en arco: 10 µs con la regla «V < 8 V dos pares seguidos», con **0 falsas por segundo** aun con 2 V de ruido de arco con colas gordas.
  - Arco apagado: 21 µs.
  - Cuello: la regla R − R_min > **5 mΩ** avisa 50–114 µs antes de que reviente el puente; con 3 mΩ avisa 111–242 µs. En los dos casos hubo 0 falsas en 300 cortos. El umbral de 8 mΩ que usa La Pluma solo da 20–55 µs.
- **Sin Q3, el aviso del cuello no sirve:** la corriente tarda 350–600 µs en bajar por D1 y el aviso llega como mucho 242 µs antes. Q3 (o un camino de bajada activo) se queda.
- **Distancia: el número que lo decide todo es E (V/mm), y está en duda.**
  - Con E = 10 V/mm (canon, medido por ian): largo de arco absoluto ±57 µm y cambios ±14 µm (1σ).
  - Con E ≈ 1.1 V/mm (columna de arco en GMAW de acero, literatura): ±514 µm y ±128 µm.
  - Los cables no son el problema: el «Kelvin por software» (la punta apretada contra la placa) deja I·R_circ en ±16 mV.
  - Lo que domina el error:
    - V0, las caídas de ánodo y cátodo: ±0.5 V.
    - I·R_st de modelo: ±0.19 V. Sobre todo pesa la temperatura de la punta de contacto: +100 K dan +185 mV.
    - El contacto deslizante entre la punta y el alambre: ±0.15 V.
- **Temperatura del alambre: PASA solo en ventanas sin arco.**
  - En cortos, R_st con ±1 mΩ da la T media del stickout con ±32 K. En toques, ±95 K (lo limita el contacto de Holm). Con el arco prendido no se puede.
  - En el punto de trabajo (40 A, 50 mm/s, 12 mm) el stickout solo llega a ~330 °C, así que en proceso no hay codo de Curie.
  - En el «fusible», en cambio, el codo se ve claro: dR/dt cae 2.9× entre 720 y 850 °C, con más de 100 σ. Es una calibración gratis.
- **Charco y placa desde V(t): INCIERTO.**
  - El modo (0,1) del charco suena a 100–300 Hz y baja 0.1 % por cada K de precalentamiento.
  - Promediando 10–75 gotas sincronizadas con la suelta, el ruido daría ±2–6 K si E = 10. Pero la amplitud es una estimación de orden de magnitud, y la literatura dice que en GMAW los impactos de gota tapan el charco.
  - El sensor más barato que sí funciona: termopar K + MAX6675, del orden de €5.
- **El oído (tamaño de gota): PASA si E = 10 y el ruido es ≤ 0.3 V; con E = 1.1 no alcanza.**
  - La campana es un chirp: f baja 3.1 % por ms mientras la gota crece. Hay que demodular contra un modelo que crece, no contra un tono.
  - Con ping fuerte (20 A × 1.2 ms) y 5 ms de escucha: ±0.3–0.4 % del tamaño (≈1.7 µm).
  - Con el ping del canon (10 A × 0.8 ms): ±1.0–1.3 %. Con 1 V de ruido: ±1.2 % (ping fuerte) o ±4 % (ping del canon).
- **El Pico 2 alcanza:** I y V a 250 kS/s cada uno, y el núcleo 1 queda al ~18 % (estimado).
  - **Pero el NTC de D1 en GP29 del plan no se puede:** en la Pico 2, GP29 mide VSYS/3 por dentro y no sale al conector.
  - La temperatura de D1 sale gratis del desacuerdo entre dos voltímetros: el ciclo de trabajo (volt-segundo) y el ADC. En simulación da −1.06 mV/K y ±1.7 K cada 100 ms.

## 3. Método

### La cadena de medida que ve el Pico (simulada a 0.2 µs)

- **V_out:** la salida de la Torre pasa por un divisor ÷16 y un RC de 50 kHz y llega a GP27.
  - Fondo de escala 52.8 V, LSB de 12.9 mV.
  - Ruido equivalente con ENOB 9 (el mínimo del datasheet del RP2350; el típico es 9.5): **29.8 mV por muestra**.
- **I:** el ACS758-050B a 3.3 V llega a GP26.
  - Da 26.4 mV/A (supuesto ratiométrico) y 120 kHz de banda, con ~4 µs de respuesta.
  - Ruido supuesto: 0.25 A rms por muestra.
- **ADC:** round-robin de dos canales, así que cada canal va a **250 kS/s** (un par cada 4 µs). Es la configuración real: 96 ciclos a 48 MHz son 2 µs por muestra.
- **Circuito de soldadura:**
  - R_circ = 20 mΩ [S]: 2 + 2 m de cable cal. 8 suman 8.2 mΩ, más la antorcha de la SOMI.
  - L_circ = 3 µH [S].
  - El rizo del PWM de 100 kHz con la bobina de 41 µH se modela con su dI/dt promediado exacto en cada paso, así que se cumple el balance volt-segundo.
- **Contacto deslizante punta–alambre:** V_punta = 0.30 V con brincos de ±0.1 V [S]. El paper de NIST da ~0.5 V a 200–450 A.
- **Arco:** V = V0 + E·L con V0 = 14 V. Se corre con E = 10 V/mm (canon) y con E = 1.1 V/mm (Zhang et al. 2019: columna de GMAW pulsada en acero, casi independiente de la corriente).
  - Ruido del arco: 0.3 / 1 / 2 V por muestra, gaussiano o t de Student con ν = 3 (colas gordas, para inestabilidad tipo autoprotegido).
  - En la distancia el ruido se modela correlado AR(1) a 40 µs.
  - **No hay dato publicado del ruido del E71T-GS a 40 A.** Por eso se barre.
- **Puente líquido:**
  - Primero moja: su radio crece de 30 µm a 0.35 mm con τ = 100 µs.
  - Luego se pellizca con la ley inercial de Day–Hinch–Lister, r = 0.717 (σ/ρ)^{1/3} τ^{2/3} [de memoria].
  - Su resistencia es R = 1.5·ρ_liq/(π r), con ρ_liq = 1.38 µΩ·m.
  - El caso «×2» supone que el pellizco magnético acelera el cierre al doble.

### Eventos simulados

Cada caso tiene 300–400 eventos con parámetros al azar:

- toque desde una OCV de 24 V, con contacto inicial de 0.5–50 Ω que se frita en 5–50 µs;
- corto en arco;
- cuello dentro de cortos de 1–4 ms;
- arco apagado (I cae con τ = 15 µs y V sube hasta el TVS de 68 V);
- suelta de gota (escalón de E × 0.8 mm).

Las falsas alarmas se cuentan sobre los tramos de arco puro.

### Distancia

- **Calibración «Kelvin por software»:** la punta de cobre se aprieta contra la placa a 10, 20 y 30 A, 20 ms por nivel. Es el mismo procedimiento que la medición «r» de Fronius y el «rL» de EWM.
- **Presupuesto 1σ:** se arma fuente por fuente, en dos versiones:
  - absoluto: una lectura;
  - cambio: lo que deriva en ~10 s del mismo cordón, con el cero ya puesto.
- **Monte Carlo:** la gota crece de 0.30 a 0.46 mm, a 75 gotas por segundo.

### Alambre como termómetro

- **Resistividad del acero bajo carbono:**
  - Ancla a 20 °C: 0.143 µΩ·m (hoja AISI 1010).
  - Forma contra T: reconstruida de memoria de las tablas ASM, NO verificada en línea [S].
  - Curie a 770 °C; arriba de ahí la pendiente cae 4×. Coincide con el orden de la cita de Erickson: ~0.2 µΩ·m a 0 °C y ~1.2 µΩ·m a 725 °C.
- **Entalpía:** cp base, más el pico magnético y la transformación α→γ, escalada a H(1480) = 1010 kJ/kg (revisión del 31 de octubre).
- **Alambre tubular:** el fleje ocupa el 65 % del área [S] y el fundente compactado pesa 3000 kg/m³ con cp = 900 [S].
- **Perfil en el stickout:** estacionario, por Joule más radiación (ε = 0.6), resuelto en coordenada del alambre.
  - La conducción se desprecia porque Pe = vL/α = 78; solo cuenta en los últimos 0.13 mm junto a la gota.
  - La temperatura a la que el alambre sale de la punta de contacto es una incógnita: se supuso 150 °C y se barrió.

### Charco

- **Modos capilares de un disco** de radio r y hondura h: ω² = (σk³/ρ + gk)·tanh(kh), con k = j/r.
- **Radio del charco:** Rosenthal con fuente puntual sobre placa gruesa, r = ηVI/(2πk(T_m − T0)).
- **Amplitud:** se estima el impulso de una gota sobre el 30 % de la masa del charco. Es un orden de magnitud, factor 3.
- **Precisión de frecuencia:** cota de Cramér–Rao de un timbre amortiguado (Q del charco = 10 [S]).

### Oído

Monte Carlo de 300 gotas por renglón:

- Timbre amortiguado con frecuencia que baja (chirp), porque la gota crece a 25 mm³/s, el ritmo del canon (75 gotas/s de 0.45 mm). El ritmo real se sortea con ±10 %.
- Guarda de 0.3 ms después del ping.
- Dos estimadores:
  - **ML:** rejilla sobre el tamaño, con fase y amplitud lineales. Es la mejor estimación posible.
  - **Lock-in:** demodulación contra la referencia del modelo, filtro de caja de un periodo y pendiente de fase. Es lo barato, lo que corre en firmware.
- Se compara contra la cota de Cramér–Rao.

### Balance volt-segundo

- Se simulan 3 s a 100 kHz, periodo por periodo, con el PI y el retardo del Hall.
- V_bus lleva ruido y rizo de 120 Hz.
- V_F de D1 = 0.55 + 0.006·I − 2 mV/K [S], y D1 se calienta 60 K en 2 s.

## 4. Resultados (telemetría)

### 4.1 Contacto

| evento | regla | latencia mediana | p95 | falsas |
|---|---|---|---|---|
| toque (desde OCV 24 V) | V < 12 V e I > 1 A, 2 pares | 26.5 µs desde que toca; 11.0 µs desde que conduce | 116 µs / 53 µs | 0/400 sin detectar |
| corto (ruido 1 V, colas t3) | V < 8 V, 1 par | 5.9 µs | 7.8 µs | 21 /s |
| corto (ruido 1 V, colas t3) | V < 8 V, **2 pares** | **9.9 µs** | 11.8 µs | **0 /s** |
| corto (ruido 2 V, colas t3) | V < 8 V, 2 pares | 9.7 µs | 11.6 µs | 0 /s (con 1 par: 200 /s) |
| arco apagado | V > 40 V, o I < 3 A y V > 25 V; 2 pares | 21.3 µs | 22.9 µs | 0 |

**El cuello.** R se estima por par, se promedia en 5 pares (20 µs) y se pide que pase el umbral dos pares seguidos. La tabla dice cuánto antes de reventar llega el aviso:

| umbral sobre R_min | radio del cuello | pellizco ×1: mediana / p5 | pellizco ×2: mediana / p5 | falsas |
|---|---|---|---|---|
| 3 mΩ | 135 µm | 242 / 190 µs | 111 / 86 µs | 0/300 |
| **5 mΩ** | 96 µm | **114 / 98 µs** | **50 / 40 µs** | 0/300 |
| 8 mΩ (La Pluma) | 67 µm | 55 / 47 µs | 20 / 16 µs | 0/300 |

Para comparar, el tiempo que tardan 40 A en llegar a 0 sin Q3, bajando por D1: **607 µs** con un corto de 2 V y **349 µs** con uno de 4 V. Con Q3 tarda menos de 2 µs.

**La gota que se suelta** produce un escalón de E × 0.8 mm:

| E | escalón | ruido | ventana | detecta | latencia | falsas |
|---|---|---|---|---|---|---|
| 10 V/mm | 8.0 V | 0.3 V | 100 µs | 100 % | 28 µs | 2.6 /s |
| 10 V/mm | 8.0 V | 1.0 V | 100 µs | 100 % | 48 µs | 5.1 /s |
| 1.1 V/mm | 0.88 V | 0.3 V | 100 µs | 100 % | 84 µs | 1.7 /s |
| 1.1 V/mm | 0.88 V | 1.0 V | 100 µs | 1.7 % | — | 5.1 /s |
| 1.1 V/mm | 0.88 V | 1.0 V | 1 ms | 100 % | 632 µs | 0 /s |

**Firmas de cada estado.** El contexto es la clave para separar toque de corto: el toque viene de OCV y el corto viene de arco.

| estado | V_out | I | R = V/I | dR/dt |
|---|---|---|---|---|
| OCV | = OCV | ~0 | ∞ | — |
| toque | < OCV/2, cae en µs | sube a 0.8 A/µs | 0.03–5 Ω, baja | negativa (el óxido se frita) |
| arco | 13–35 V | la pedida | 0.3–0.9 Ω | ruido |
| corto (puente) | 1–4 V | la pedida | R_circ + R_st + 1–3 mΩ | primero baja (moja), luego sube |
| cuello | 1–4 V y subiendo | la pedida | R_min + 3…10 mΩ | > 0, acelerando (~τ^{−5/3}) |
| arco apagado | > 40 V (o > OCV) | < 3 A, cayendo | → ∞ | — |
| gota se suelta | escalón +E·0.8 mm | igual | escalón | — |

**Escoria en la punta.** El E71T-GS deja una bola de escoria en la punta. Si mide más de ~1 kΩ, 24 V no la fritan y el toque nunca aparece. Regla de firmware: si el avance ya recorrió stickout + hueco (unos 300 ms a 50 mm/s con 15 mm) y la salida sigue en OCV, es escoria. Hay que parar y cortar la punta.

**Comparador de 1 bit sin ADC (opcional, son dos resistencias y un diodo).**

- Un divisor ÷6.4 (54k/10k) lleva V_out a un GPIO normal, del 0 al 25, que tolera 5.5 V con IOVDD encendido.
- Con V_IL ≤ 0.8 V y V_IH ≥ 2.0 V (tabla 1683 del datasheet), el GPIO lee «bajo» seguro con V_out < 5 V y «alto» seguro con V_out > 13 V.
- Un diodo a 3.3 V protege la pata cuando la salida está en OCV.
- El PIO lo muestrea cada 6.7 ns, así que ve el corto en menos de 0.1 µs, sin pasar por el ADC.

### 4.2 Distancia

**Calibración por toque de punta** (3 niveles × 20 ms):

- R estimada con ±0.082 mΩ de ruido y un sesgo de +0.13 mΩ. El contacto cobre–placa (0.2–1 mΩ) queda dentro de la medida.
- A 40 A eso da ±16 mV.
- L_circ sale del salto de V entre ON y OFF del PWM: L_circ·V_bus/L_choke = 3.5 V con 3 µH. Se ve sin esfuerzo.

**Presupuesto 1σ** a 40 A, con ventana = 1 periodo de gota (13.3 ms):

| fuente | abs mV | cambio mV | abs µm (E=10) | abs µm (E=1.1) | cambio µm (E=10) | cambio µm (E=1.1) |
|---|---|---|---|---|---|---|
| ADC, ruido blanco | 0.5 | 0.5 | 0.1 | 0 | 0.1 | 0 |
| ADC, offset (cero con la salida apagada) | 16 | 0 | 1.6 | 15 | 0 | 0 |
| ganancia ADC + divisor (deriva 0.2 %) | 40 | 4 | 4.0 | 36 | 0.4 | 4 |
| R_circ por toque de punta | 16 | 0 | 1.6 | 15 | 0 | 0 |
| R_circ, calentamiento del cobre | 14 | 14 | 1.4 | 13 | 1.4 | 13 |
| V_punta, contacto deslizante (media) | 150 | 0 | 15 | 136 | 0 | 0 |
| V_punta, brincos | 50 | 50 | 5 | 45 | 5 | 45 |
| **I·R_st por modelo** | **191** | **92** | 19 | 174 | 9 | 84 |
| **V0 (caídas de ánodo/cátodo)** | **500** | 50 | 50 | 455 | 5 | 45 |
| ruido del arco, 1 V (N_ef = 166) | 78 | 78 | 7.8 | 71 | 7.8 | 71 |
| **TOTAL** | **566** | **141** | **57** | **514** | **14** | **128** |

Cómo se arma I·R_st por modelo. El stickout de 12 mm a 40 A da V_st = 0.43 V, y esto lo mueve:

| cambio | efecto en V_st |
|---|---|
| T de entrada +100 K | +185 mV |
| stickout +1 mm | +48 mV |
| avance −10 % | +15 mV |

Si R_st se mide en los cortos (±1 mΩ), el renglón baja de 191 a 40 mV.

**Monte Carlo con la gota creciendo** (diente de sierra de 320 µm pico a pico):

| E | ruido | ventana = 1 gota | ventana de 1 ms |
|---|---|---|---|
| 10 | 0.3 V | 2.4 µm | 8.1 µm |
| 10 | 1.0 V | 7.0 µm | 27 µm |
| 10 | 2.0 V | 14.8 µm | 57 µm |
| 1.1 | 0.3 V | 21 µm | 74 µm |
| 1.1 | 1.0 V | 71 µm | 247 µm |
| 1.1 | 2.0 V | 125 µm | 510 µm |

Si la ventana es fija por reloj y el periodo de gota varía ±10 %, se filtran 7.4 µm de diente de sierra. Por eso **la ventana se cierra en cada suelta detectada**, no por reloj.

**CTWD.** El lazo de La Pluma es de corriente constante. Ahí el derretido no depende del largo del arco, así que un cambio de CTWD pasa entero al arco: dV = E·dCTWD. El stickout lo fija el balance de derretido v_f = αI + βL_st·I² (Lesnewich, de memoria), y se calibra una vez por cada par (I, v_f). Es la misma lógica que el «through-arc sensing» de la literatura, pero al revés: allá la fuente es de voltaje constante y la que lee es la corriente.

**La quema** (el experimento que mide E): con I fija se detiene el avance. El arco crece a la velocidad de derretido, que es la v_f de antes, así que dV/dt = E·v_f.

| v_f | E = 10 | E = 3 | E = 1.1 |
|---|---|---|---|
| 35 mm/s | 350 V/s (+17.5 V en 50 ms) | 105 V/s | 38 V/s (+1.9 V en 50 ms) |
| 50 mm/s | 500 V/s | 150 V/s | 55 V/s |

Con 1 V de ruido, la pendiente se mide con ±0.6 V/s en 50 ms. Lo que de verdad limita es v_f (±10 %).

### 4.3 Temperatura

**(a) Resistividad del acero.** El cociente ρ/ρ20 vale 1.00 a 20 °C, 3.20 a 400 °C, 6.26 a 700 °C, 7.13 a 770 °C, 7.84 a 900 °C y 8.95 a 1500 °C. La pendiente es de 0.179 µΩ·m por 100 K entre 700 y 770 °C, y de 0.045 entre 800 y 900 °C. **El codo de Curie: la pendiente cae 4×.**

**Stickout en tránsito** (entra a 150 °C; se muestra «fundente sigue / fundente no»):

| I | v_f | L_st | T al final °C | R_st mΩ | V_st V |
|---|---|---|---|---|---|
| 30 A | 50 mm/s | 10 mm | 225 / 255 | 7.8 / 8.1 | 0.23 / 0.24 |
| **40 A (ref.)** | **50 mm/s** | **12 mm** | **332** | **10.8** (frío: 5.3) | **0.43** |
| 45 A | 35 mm/s | 15 mm | 741 / 1031 | 21.9 / 28.7 | 0.99 / 1.29 |
| 45 A | 35 mm/s | 20 mm | 1102 / 1530 | 38.8 / 47.9 | 1.75 / 2.16 |
| 60 A | 50 mm/s | 15 mm | 988 / 1479 | 27.4 / 34.2 | 1.65 / 2.05 |
| 60 A | 35 mm/s | 15 mm | funde en tránsito | 36.7 / 42.9 | 2.20 / 2.57 |

El perfil en el punto de referencia sube de 150 °C a 332 °C a lo largo de los 12 mm. Si la punta de contacto se calienta 200 K, el final llega a 673 °C y V_st sube 430 mV. Eso son 43 µm de «arco falso» con E = 10, o 391 µm con E = 1.1.

**Cuándo se puede leer R_st.** Con el arco prendido no se puede: su V/I es de 0.5 Ω, mucho mayor que R_st, y su característica dinámica es desconocida.

| ventana | σ de R | T media del stickout |
|---|---|---|
| corto (puente de 1–3 ms) | 1.0 mΩ (el puente es incierto en ±1 mΩ) | 236 °C ± 32 K |
| toque de arranque, en frío | 3.0 mΩ (contacto de Holm) | ± 95 K |
| re-toque < 0.2 s después de apagar | 3.0 mΩ (el alambre se enfría ~56 K/s por radiación) | ± 95 K |
| entre pulsos de un arco pulsado | — | no se puede: sigue habiendo arco |

**Fusible** (alambre quieto de 30 mm, sin pérdidas a las pinzas):

| I | R va de → a | pasa Curie a | funde a | dR/dt a 720 °C | dR/dt a 850 °C |
|---|---|---|---|---|---|
| 30 A | 13.1 → 117.5 mΩ | 1481 ms | ~2076 ms | 120 mΩ/s | 41 mΩ/s |
| 40 A | 13.1 → 117.6 mΩ | 829 ms | ~1146 ms | 217 mΩ/s | 75 mΩ/s |

En los dos casos la pendiente cae **2.9×**: ese es el codo. El ruido de R es de 0.99 mΩ por par a 30 A, y de 0.02 mΩ promediando 10 ms, así que el codo se ve con más de 100 σ.

**(b) Charco y placa.**

Frecuencias de los modos del charco (Hz):

| radio r | hondura h | modo (0,1) | modo (1,1) | modo (0,2) |
|---|---|---|---|---|
| 1.0 mm | 0.50 mm | 542 | 158 | 1369 |
| 1.5 mm | 0.75 mm | 295 | 87 | **745** (choca con f₂ = 668 Hz) |
| 2.0 mm | 1.00 mm | 192 | 57 | 485 |
| 3.0 mm | 1.50 mm | 106 | 32 | 264 |

Con Rosenthal (η = 0.8, 20 V, 40 A), el charco crece al calentarse la placa:

| placa a | radio del charco | f(0,1) |
|---|---|---|
| 20 °C | 2.29 mm | 157 Hz |
| 200 °C | 2.61 mm | 129 Hz |
| 400 °C | 3.09 mm | 101 Hz |
| 600 °C | 3.77 mm | 75 Hz |

La sensibilidad es de −0.10 % por K. La patada de una gota de 0.46 mm a 1 m/s mueve el charco unos 67–104 µm. Eso son 0.7–1.0 V con E = 10, o 0.07–0.11 V con E = 1.1 (orden de magnitud).

Precisión al promediar N patadas sincronizadas con la suelta (cota de Cramér–Rao, amplitud de 50 µm, Q = 10, 10 ms por patada):

| E | ruido | N = 1 | N = 10 | N = 75 | N = 750 |
|---|---|---|---|---|---|
| 10 | 1 V | 1.9 % (19 K) | 0.6 % (6 K) | 0.22 % (2 K) | 0.07 % (1 K) |
| 1.1 | 0.3 V | 5.2 % (51 K) | 1.6 % (16 K) | 0.6 % (6 K) | 0.19 % (2 K) |
| 1.1 | 1 V | 17 % (171 K) | 5.5 % (54 K) | 2.0 % (20 K) | 0.63 % (6 K) |

Esto es **solo ruido**. Pasar de f a T0 depende de η, de la velocidad de avance y de la hondura del charco: sirve como indicador **relativo** («la placa se está calentando»), no como termómetro absoluto.

### 4.4 El oído

f₂(0.46 mm) = 668 Hz. Mientras suena, la gota crece y la frecuencia baja 3.1 % por ms. El timbre dura τ = 14.3 ms con Q = 30 y 4.8 ms con Q = 10.

Lo que da cada ping:

| ping | q0 | la punta se mueve | señal con E = 10 | señal con E = 1.1 |
|---|---|---|---|---|
| 10 A × 0.8 ms (canon) | 0.036 | 16 µm | 0.16 V | 0.018 V |
| 20 A × 1.2 ms (fuerte) | 0.107 | 49 µm | 0.49 V | 0.054 V |

Precisión del tamaño, en σ robusta (en µm sobre 460 µm). Todo con 5 ms de escucha y Q = 30, salvo donde se indica:

| E | ruido | ping | Cramér–Rao | ML | lock-in | lock-in, errores > 3 % |
|---|---|---|---|---|---|---|
| 10 | 0.1 V | fuerte | 0.11 % | 0.13 % | 0.16 % (0.7 µm) | 0 % |
| 10 | 0.3 V | canon | 0.96 % | 1.01 % | 1.29 % (5.9 µm) | 0.7 % |
| 10 | 0.3 V | fuerte | 0.31 % | 0.29 % | **0.38 % (1.7 µm)** | 0 % |
| 10 | 0.3 V | fuerte, Q = 10 | 0.47 % | 0.49 % | 0.63 % (2.9 µm) | 0 % |
| 10 | 1.0 V | canon | 3.2 % | 3.4 % | 4.2 % (19 µm) | 48 % |
| 10 | 1.0 V | fuerte | 1.04 % | 1.02 % | 1.18 % (5.4 µm) | 3.7 % |
| 1.1 | 0.1 V | fuerte | 0.98 % | 0.87 % | 1.35 % (6.2 µm) | 2.7 % |
| 1.1 | 0.3 V | fuerte | 2.8 % | 3.1 % | 3.8 % (17 µm) | 43 % |
| 1.1 | 1.0 V | fuerte | 9.4 % | 8.2 % | 14 % (66 µm) | 79 % |

Con 2 ms de escucha, el lock-in pierde mucho (2–3 %, contra 0.4–1.1 % del ML): su caja de un periodo (1.5 ms) se come la ventana. **Se escuchan 5 ms.**

El Monte Carlo del canon (`canon_gota.py`) supuso 10 mV de ruido por muestra, unas 30 veces menos que la fila de 0.3 V de esta tabla. El ±0.3 % del canon solo se sostiene si el arco real es así de callado, y eso se mide en el paso 2 de §7.

Los sistemáticos que el ruido no ve:

- **La corriente base afloja la gota:** f baja 2 % y el tamaño sale +1.3 % (6 µm). Se corrige oyendo a dos corrientes base.
- **El amortiguamiento corre f en 1/(8Q²):** 0.13 % con Q = 10.

### 4.5 Presupuesto del Pico 2

- **ADC:** round-robin {GP26 = I, GP27 = V}, 250 k pares por segundo. Llega por DMA a un anillo en RAM a 1 MB/s.
- **Núcleo 1:** tiene 600 ciclos por par. Su gasto estimado (no medido) es de **110 ciclos (18 %)**:

| tarea | ciclos por par |
|---|---|
| escala y offset | 8 |
| R = V/I (FDIV) y mínimo corriendo | 22 |
| máquina de estados | 30 |
| detector de escalón | 12 |
| acumuladores volt-segundo y ventanas por gota | 12 |
| lock-in | 20 |
| registro | 6 |

- **V_bus (GP28):** basta 1 lectura por ms; se cambia la máscara del round-robin y se pierde el 0.4 % de los pares.
- **Relojes:** clk_adc de 48 MHz sale del PLL USB y el PWM de clk_sys (150 MHz). Los dos vienen del mismo cristal de 12 MHz, así que quedan enganchados: 5 muestras por periodo de PWM. Promediando 2 periodos (5 pares), el rizo y el término L·dI/dt se cancelan, salvo el 5.º armónico, que cae en DC.
  - Cuadrada de ±2.05 V antes del filtro → 522 mV.
  - Tras un RC de 1 polo a 50 kHz → **52 mV de sesgo fijo**. Depende de D; se calibra con el toque.
  - Tras un RC de 2 polos a 30 kHz → **1.9 mV**. Cuesta ~11 µs de latencia en el ADC, pero el corto lo ve el comparador de 1 bit.
- **PIO:**

| máquina | tarea |
|---|---|
| PIO0 SM0 | PWM de Q1 (HIN), con IRQ al centro del ON y del OFF |
| PIO0 SM1 | comparador de 1 bit |
| PIO0 SM2 | baja HIN sin esperar al núcleo |
| PIO1 SM0 | motor del avance |
| PIO1 SM1 | LED de sincronía con la cámara |

- **Núcleo 0:** el PI a 100 kHz (~10 %), los estimadores lentos y el USB.
- **Memoria y USB:** la RAM guarda ~312 ms de datos crudos. El USB FS no saca 1 MB/s, así que se registra decimado (10 kS/s, 40 kB/s) más ráfagas crudas de cada evento.

### 4.6 Lente del operador

**El ciclo de trabajo como voltímetro.** La bobina devuelve todo lo que presta: ∫L·dI = L·(I_fin − I_ini). Por eso D·V_bus − (1 − D)·V_F − I·R − L·ΔI/T_ventana es la media exacta de V_out, sin muestrear V_out.

- El ruido del término L·ΔI/T es de 1.45 V por periodo, pero se **telescopa**: en una ventana de 10 ms baja a 1.4 mV.
- En simulación, este voltímetro 1 tiene un sesgo de −42 mV (V_F nominal) y σ = 22 mV contra la verdad, porque arrastra la deriva de D1.
- El voltímetro 2, el ADC directo, tiene σ = 0.6 mV por ventana.
- **El desacuerdo de los dos (1 − 2) contra la T de D1 da −1.06 ± 0.02 mV/K**, que es exactamente lo teórico, −(1 − D)·2 mV/K. El residuo es de 5.9 mV por ventana.
- Resultado: un termómetro de D1 con **±6 K cada 10 ms y ±1.7 K cada 100 ms**, sin NTC. Esto es simulación; los sistemáticos de verdad (los retardos del IR2110, ~120 mV, y R_ds(T)) se calibran en frío contra el voltímetro 2.

**El canal sin actuador propio.** El postulado de canal aplicado al sensado dice que cada cantidad necesita su banda, su ventana de tiempo o su estado, o se diluye en las demás:

| cantidad | su canal | ¿actuador propio? | con qué choca |
|---|---|---|---|
| contacto | amplitud de V, µs, transición OCV → toque | sí (la OCV) | — |
| corto y cuello | R en el estado CORTO, 4–40 µs | no (lo hace la gota) | ruido del ADC (1 mΩ por par) |
| largo de arco | DC < 75 Hz, ventana = 1 gota | I y avance (lentos) | V_punta, I·R_st, V0 |
| suelta de gota | escalón de 100 µs | la onda a f₂ | ruido del arco |
| tamaño de gota | chirp de 1300 → 600 Hz después de un ping | la onda a f₂ | el modo (0,2) del charco, ~600–750 Hz |
| charco (tamaño, T0) | 100–300 Hz, **sincronizado con la suelta** | **no: lo patea la gota** | impactos de gota, f₂ |
| T del stickout | R **en estado CORTO o TOQUE** | **no: I² lo mezcla** | R del puente, Holm |
| T de D1 | **desacuerdo de los dos voltímetros** | no | ganancias (se calibran) |

La lectura útil del marco: **los canales sin actuador propio se observan paténdolos con otro canal y promediando en sincronía con la patada.**

- La gota es el actuador del charco: se promedia sincronizado con la suelta.
- El corto es la ventana donde el stickout queda solo: se lee R ahí.
- Dos medidas del mismo voltaje, con física distinta, dan un tercer canal, la temperatura de D1. Es «acuerdo o silencio»: si los dos voltímetros no coinciden, el firmware no confía en ninguno.

Todo esto es física estándar; el marco solo ayudó a encontrarlo.

## 5. Veredictos

| # | hipótesis | veredicto | qué lo decide |
|---|---|---|---|
| 1 | Toque, corto, arco, arco apagado y cuello se distinguen con solo V e I, en ≤ 25 µs y sin falsas | **PASA** (simulado: 10–21 µs, 0 falsas con 2 pares) | grabar 100 cortos reales a 250 kS/s y contar falsas |
| 1b | El aviso del cuello basta para bajar la corriente sin Q3 | **FALSA**: el aviso llega 50–242 µs antes y el drenaje por D1 tarda 349–607 µs | — |
| 1c | El umbral del cuello de 8 mΩ es el bueno | **FALSA** por conservador: 5 mΩ da el doble de aviso, sin falsas | R(t) de cortos reales |
| 2 | V da el largo de arco a ±50 µm | **INCIERTO**: ±57 µm (absoluto) y ±14 µm (cambios) si E = 10; ±514 / ±128 µm si E = 1.1 | **la quema**: 350 contra 38 V/s |
| 2b | El «Kelvin por software» por toque elimina la caída de los cables | **PASA** (±16 mV a 40 A), pero no ve V_punta (±150 mV) ni I·R_st (±191 mV), que son mayores | — |
| 3a | El alambre libre es un termómetro | **PASA** en el fusible (codo de Curie de 2.9×, > 100 σ) y en cortos o toques (±32 / ±95 K); **FALSA** con el arco prendido | fusible a 30 A: el codo a ~1.5 s y 94 mΩ |
| 3b | La temperatura de la placa se puede inferir de V(t) por la frecuencia del charco | **INCIERTO**: la física da 0.1 %/K, pero la amplitud y la literatura de GMAW no ayudan | promediar V después de 75 sueltas y buscar una línea de 100–300 Hz que baje al calentarse la placa |
| 3c | Si no se puede, ¿qué sensor? | termopar K + MAX6675 (€4.60 en eBay DE; el precio en MX no se verificó), soldado bajo la placa con el modo PUNTO | — |
| 4 | El oído da el tamaño a ±0.3 % | **INCIERTO**: PASA con E = 10, ruido ≤ 0.3 V, ping fuerte y 5 ms; con el ping del canon da 1–1.3 %; con E = 1.1 da ≥ 3 % | la quema (E) y el ruido del arco medido (ver §7) |
| 5 | El Pico 2 alcanza | **PASA** (núcleo 1 al ~18 %, estimado), con dos condiciones: la Pico 2 solo saca 3 entradas de ADC, y el registro crudo no cabe en el USB | contar ciclos en la placa |
| 6 | El volt-segundo es un sensor | **PASA** (simulado): voltímetro sin ADC con ~mV en 10 ms; su desacuerdo con el ADC mide la T de D1 con ±1.7 K cada 100 ms | comparar en el banco con un termopar en D1 una vez |

## 6. Qué cambia

**Circuito y lista de componentes:**

- **Quita** el NTC de D1 en GP29: en la Pico 2, GP29 = VSYS/3 y no sale al conector. Su función la hace el desacuerdo volt-segundo contra el ADC.
- **Mantén Q3** (el crowbar). Sin él, el aviso del cuello no sirve para nada.
- **Cambia** el RC de V_out a dos polos de 30 kHz (dos resistencias y dos capacitores). Si no, calibra el sesgo de 52 mV del 5.º armónico con el toque.
- **Opcional, menos de US$1:**
  - Un divisor ÷6.4 + diodo a un GPIO normal, como comparador de 1 bit para el PIO.
  - Un LM4040 de 3.0 V en ADC_VREF: el datasheet de la Pico 2 lo recomienda; baja 10× la deriva de ganancia.
- **Opcional, unos €5:** termopar K + MAX6675, solo si la prueba del charco falla y se necesita la T de la placa.

**Firmware:**

1. **Arranque:**
   - Cero del ADC con la salida apagada.
   - GPIO23 en alto (SMPS en modo PWM, menos rizo en el ADC).
   - clk_adc del PLL USB.
   - Round-robin {I, V}, con V_bus una vez por ms.
2. **Calibración de sesión** (unos 10 s):
   - Toque de punta a 10, 20 y 30 A durante 20 ms cada uno → R_circ, L_circ y el sesgo de aliasing.
   - La quema → E y V0_eff.
   - El valor de V justo al encender el arco → V0.
3. **Máquina de estados** en el núcleo 1, con las reglas de §4.1:
   - corto: V < 8 V dos pares seguidos;
   - cuello: R − R_min > **5 mΩ** (promedio de 5 pares, dos confirmaciones) → Q3;
   - arco apagado: V > 40 V, o I < 3 A y V > 25 V;
   - escoria: no hubo toque después de (stickout + hueco)/v_f.
4. **Distancia:**
   - Ventana que se cierra en cada suelta detectada.
   - L = (V̄ − I·R_circ − V0_eff − I·R_st)/E.
   - R_st se toma de los cortos o del modelo de tránsito con la T de la punta.
   - Si E sale de 1–3 V/mm, el largo de arco se reporta como «silencio» abajo de ±0.2 mm; no se inventa.
5. **Oído:**
   - Ping de 20 A × 1.2 ms.
   - Guarda de 0.3 ms y escucha de 5 ms.
   - Lock-in contra un modelo que crece al ritmo del avance (caja de un periodo y pendiente de fase).
   - Dos corrientes base para quitar el +1.3 %.
6. **Temperatura:**
   - R_st en cada corto o toque → T media del stickout.
   - El fusible da el codo de Curie como calibración.
   - La T de D1 sale del desacuerdo entre los voltímetros.

## 7. El experimento más barato que lo decide

**La quema**: unos 10 minutos con el banco mínimo, sin piezas nuevas.

1. **Toque de punta.** Sin alambre, la punta se aprieta contra la placa a 10, 20 y 30 A, 20 ms cada uno. Predicción: R_circ entre 10 y 25 mΩ; si sale arriba de 50 mΩ, hay una mala unión.
2. **Arco.** 40 A con avance a 35 mm/s, 2 s para estabilizar. Se graba V e I a 250 kS/s.
   - **Si E = 10:** escalones de ~8 V en cada suelta de gota, visibles a ojo en la traza cruda.
   - **Si E ≈ 1.1:** escalones de < 1 V, enterrados en el ruido.
   - La desviación estándar de V con el arco quieto da el ruido real que necesitan las tablas de §4.4.
3. **Se para el motor del avance 80 ms**, con I fija. Se ajusta la pendiente de V entre 30 y 80 ms después de la orden; los primeros ~30 ms son para que se detenga el motor.
   - **Si el canon (10 V/mm) es correcto:** **350 V/s**, unos +17 V en 50 ms. El arco se apaga hacia +15 V por el tope de duty de 0.75, lo cual también sirve para probar la detección de apagado.
   - **Si la literatura (≈1.1 V/mm) es correcta:** **38 V/s**, unos +1.9 V en 50 ms, y el arco sigue prendido.
   - Umbral de decisión: más de 200 V/s, el canon se queda; menos de 70 V/s, se rehacen las tablas de distancia y del oído con E de verdad.
4. **Se deja que corte.** Se baja la corriente o se mete avance hasta tener cortos. Predicción de R en corto: R_circ + 11 ± 2 mΩ (stickout de 12 mm a ~240 °C de media) + 1–3 mΩ del puente.

Si además se quiere el codo de Curie: el **fusible** con 30 mm de alambre entre pinzas a 30 A. La predicción es R de 13 → 94 mΩ en ~1.5 s, con dR/dt que cae de ~120 a ~41 mΩ/s al pasar de 720 a 850 °C, y que funde a ~2.1 s. La placa no sale exacta: lo que la decide es la **forma** de la curva.

## 8. Fuentes

- RP2350, datasheet: ENOB 9 mínimo / 9.5 típico (tabla 1685), 96 ciclos a 48 MHz = 500 kS/s, impedancia de entrada > 100 kΩ, V_IL ≤ 0.8 V / V_IH ≥ 2.0 V e histéresis de 0.2 V a 3.3 V (tabla 1683), pines FT de hasta 5.5 V. https://pip-assets.raspberrypi.com/categories/1214-rp2350/documents/RP-008373-DS-2-rp2350-datasheet.pdf
- Pico 2, datasheet: GPIO29 = ADC3 mide VSYS/3; ADC_AVDD sale del SMPS por RC (201 Ω, 2.2 µF); offset de ~30 mV; GPIO23 pone el SMPS en modo PWM; recomienda LM4040; los pines de ADC no aguantan más de IOVDD + 0.3 V. https://pip-assets.raspberrypi.com/categories/1005-raspberry-pi-pico-2/documents/RP-008299-DS-3-pico-2-datasheet.pdf
- Zhang, Goett, Kozakov, Uhrlandt, Reisgen et al., «Study of the arc voltage in gas metal arc welding», J. Phys. D 52 (2019) 085202, DOI 10.1088/1361-6463/aaf588. Columna de ~1.1 V/mm, casi independiente de la corriente; vainas de 18–23 V a 350–650 A. Leído solo el resumen, vía catálogo y extracto de scite: https://vufind.katalog.k.utb.cz/SummonRecord/FETCH-LOGICAL-c310t-9dae7a829a1306f77fd1196d182cf26a5d6864082f52f810c994750863fbdade3 y https://scite.ai/authors/g-zhang-AxEnlZ
- GMAW en aluminio, 0.62 V/mm y caídas de ~18.3 V (solo el resumen): https://www.cwbgroup.org/node/62225
- Egerland, «A Contribution to Arc Length Discussion», Soldagem & Inspeção 20(3) 2015. Las definiciones de largo de arco varían; ~3 mm en GMAW-P. https://www.scielo.br/j/si/a/JsPyR4xG3ZLJWyH7mz7JGTj/?lang=en
- Fronius, medición de la resistencia del circuito «r»: se aprieta la herramienta contra la pieza. https://www.manualslib.de/manual/622274/Fronius-Transpocket-4000-Cel.html?page=95
- EWM, «rL» (punta contra la pieza, ~2 s): https://www.ewm-group.com/images/pdf/leitungswiderstand/099-MM00LW-EW520.pdf
- Patente para caracterizar R y L del circuito de soldadura: https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/7683290
- NIST, temperatura del tubo de contacto: caída de ~0.5 V en la interfaz a 200–450 A. Solo el extracto de la búsqueda; el PDF no abrió. https://corpora.tika.apache.org/base/docs/govdocs1/504/504243.pdf
- Kobelco ABC, contacto irregular entre alambre y punta: https://kobelco-welding.jp/education-center/abc/ABC_2004-01.html
- Hermans y den Ouden, «Process stability and weld pool oscillation during short circuiting GMA welding» (1996): la estabilidad es máxima cuando la frecuencia de corto iguala la del charco. https://www.osti.gov/biblio/442977
- Aendenroomer y den Ouden, «Weld pool oscillation during pulsed GTA welding» (1996): la frecuencia del charco medida por FFT del voltaje del arco. https://www.osti.gov/biblio/443008
- Through-arc sensing (Kim y Na; KAIST): https://dspace.kaist.ac.kr/handle/10203/58430
- GMAW pulsado, CTWD lineal en V y en frecuencia de pulso (Sensors 2017): https://pmc.ncbi.nlm.nih.gov/articles/PMC5375877
- AISI 1010: 14.3 µΩ·cm a 20 °C. https://www.mwcomponents.com/uploads/Resource-Center/Elgin-Material-Sheets/Carbon-Steel-Grade-1010-Data-Sheet_Elgin-Fasteners.pdf
- Acero al carbono: ~20 µΩ·cm a 0 °C → ~120 µΩ·cm a 725 °C; no magnético arriba de ~750 °C. Cita a Erickson. https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/7100994
- Comportamiento crítico de la resistividad del hierro en Curie: https://scilit.net/publications/ee912a9bbd78ba20121f54def1747a1b
- ACS758: 3.0–5.5 V, 120 kHz, «NOT FOR NEW DESIGN». https://www.allegromicro.com/en/products/sense/current-sensor-ics/integrated-current-sensors/acs758/acs758-faq
- Estabilidad del arco en FCAW autoprotegido (usa Std(U) y CV(U); sin números útiles para el E71T-GS): https://doaj.org/article/1d4152fe1ea34ea59b35bd6c9df3032b
- MAX6675 con termopar K: €4.60 en eBay DE (https://www.ebay.de/itm/272527359611); anuncio en Mercado Libre MX, sin precio en el extracto (https://www.mercadolibre.com.mx/shorts/clips/NulEmv/modulo-termopar-tipo-k-max6675)
- **De memoria, sin verificar en línea:**
  - la forma de ρ(T) del acero 1008 (ASM Handbook);
  - Day, Hinch y Lister, PRL 1998 (coeficiente 0.717 del pellizco inercial);
  - Rosenthal (fuente puntual);
  - la ecuación de derretido de Lesnewich (1958);
  - el ruido del ACS758 (~10 mV);
  - V_F(T) del MBR40100CT;
  - los retardos del IR2110.
