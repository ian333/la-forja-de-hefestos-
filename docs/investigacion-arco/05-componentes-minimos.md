# 05 · Menos piezas, más control: LRS + La Pluma + alimentador SOMI en una base

> Agente 05 · 2026-11-05 · script `scripts/investigacion-arco/05_componentes_minimos.py`, salida cruda `05_componentes_minimos.out` (ngspice 36, 21 simulaciones). Todo número de este reporte sale de ese `.out`, salvo los marcados «hoja de datos» o «de memoria».

## 1. La pregunta

¿Qué piezas de La Pluma + el banco nuevo (LRS-1200-48, alimentador SOMI atornillado con M8 a una base) se pueden quitar o fundir sin perder control, y cuál es el circuito mínimo que aguanta arranque, corto, apagado y regulación?

## 2. La respuesta corta

- **63 → 47 piezas eléctricas (−25 %).** Se van Q3 y su compuerta, el TVS, el snubber RC, los dos zeners, Rg_off + su diodo, el Hall con su riel de 5 V y su divisor, la NTC, el divisor de V_bus, el sangrado de 1 k, los GX12, el zumbador, la pinza de tierra y los dos cables de 2 m. Entran el shunt + INA240, D2 (diodo salida→bus), el puente H del motor con su lectura de fcem, un termostato en el lazo de paro y un segundo capacitor de película.
- **El choque no se puede quitar, pero sí achicar.** Los cables y las barras dan entre 0.06 y 3.5 µH, que a 100 kHz significan 34–1873 A pp de rizo. Lo que sí se puede es bajarlo de 40 a 18 vueltas (41 → 15 µH): la pérdida en el choque baja de 35.6 a 17.7 W, la energía guardada de 33 a 12 mJ, y el escalón de 20 a 40 A tarda 23 µs en lugar de 307 µs.
- **Circuito mínimo validado en ngspice** (40 A, arco de 1 mm, 100 kHz):

  | magnitud | valor |
  |---|---|
  | Vds máximo | 78 V |
  | inversa en D1 | 63 V |
  | VS contra COM (Kelvin) | −0.8 V |
  | VBS | 12.0 V |
  | rizo | 7.6 A pp |
  | pérdidas | 92 W (BASE: 104 W) |
  | eficiencia | 91.5 % |

  **Condición dura:** el lazo Q1–D1–Cf debe medir ≤ 15–20 nH y los electrolíticos tienen que ir pegados (≤ 30 nH). Con un lazo de 30 nH D1 llega a 99 V, y su ruptura es de 100 V. Con la onda de 40 + 30 A (picos de 70 A) D1 llega a 94 V: para el campanazo, D1 debe ser de 150–200 V.
- **Control que se gana:**
  - Arrancar retrayendo el alambre en vez de fundirlo: la corriente en la ruptura baja de 38.9 a 14.5 A y la energía del cuello de 3.16 a 0.45 mJ (7× menos).
  - Corto con «baja a 10 A»: la corriente en la ruptura queda en 9.6 A (contra 39), sin Q3.
  - D2: si el arco se apaga a 40 A, la salida no pasa de 53 V (hoy, 103 V) y la bobina queda en cero en 18 µs.
  - El motor se vuelve un segundo actuador con canal propio: volumen + retracción, con la velocidad medida por fcem.
- **Lo que NO se quita:** el PARO (corta la AC de la LRS y abre SD), el fusible y el termostato en SD.
- **Tres hallazgos de paso:**
  1. La tarjeta Pico 2 tiene solo 3 ADC libres, porque GP29 lee VSYS/3. La NTC del plan §10 en GP29 no funcionaría.
  2. La LRS-1200 pide 180–305 Vac (no entra a 127 V).
  3. A 40 A, un gap de más de ~1.4 mm pasa del 105 % de la LRS, y la LRS se apaga a los 5 s. La cuenta: MIN pide 1084.6 W con 1 mm (`.out` §3.1); cada 0.1 mm más a 40 A suma 40 W; el 105 % son 1260 W → 1.0 + 175/400 = 1.44 mm.

## 3. Método

- **Base de las simulaciones.** Todo parte del netlist de `scripts/la-pluma/la_pluma.py` (buck del lado alto con el modelo VDMOS del IRFB4227, MBR40100CT, bootstrap del IR2110 y LRS con 15 mΩ).
  - **BASE20:** La Pluma tal cual, a 20 kHz: 41 µH, Hall con 120 kHz + 1 µs, TVS, snubber, zeners, Rg_off de 33 Ω, lazo de 30 nH, Cout de 10 µF + 1 k, cable de 0.5 µH.
  - **MIN:** el circuito mínimo, más 9 variantes que mueven una pieza a la vez.
- **Carga.** Contacto, puente y arco por escenario. El arco es **V = 14 + 10·gap[mm] + 0.02·I** (medido por ian, + 20 mΩ). El arco muere si I < 1 A después de 50 µs y renace en cada contacto.
- **Firmware.** Equivalente analógico: PI de corriente con alimentación anticipada, OCV en todo-nada, detección de toque (I > 0.5 A), detección de corto (V < 8 V) y KILL.
- **Arranque.** El tiempo mecánico del arranque está comprimido 10×. El lazo eléctrico es más de 100× más rápido que la mecánica, así que la compresión no cambia los picos.
- **Corto y apagado.** Arrancan con un toque de 0.2 ms, de modo que el arco nace a 40 A.
- **Motor.** Modelo de motor DC con engranes. **Los parámetros son SUPUESTOS** (el motor de la SOMI no está medido): 12 V, 1.2 Ω, 1.2 mH, K = 0.021 V·s/rad, J = 8×10⁻⁶ kg·m², reducción 40:1, rodillo de r = 15 mm y arrastre del alambre de 6 N.
- **Campo en el arco.** La placa de 100×50×3 se resuelve por Laplace en una rejilla de 1 mm, y el campo B se calcula por Biot–Savart exacto de segmentos. Verificado: un hilo largo a 1 cm da 0.800 mT, y uno semi-infinito a 30 mm da 0.133 mT.
- **Límite del modelo.** Los picos de Vds y VD1 dependen del modelo VDMOS (no se validó contra la hoja de datos del IRFB4227) y del lazo supuesto. Por eso el experimento 1 los mide antes de quitar nada.
- **Inductancias.** Fórmulas estándar: dos hilos µ0ℓ/π·(ln(d/r)+¼), barra laminada µ0ℓ·h/w, y la bobina con la fórmula de Wheeler (de memoria; con 40 vueltas reproduce 40.8 µH contra los 41 del diseño).

## 4. Resultados

### 4.1 Lo que hay hoy: 63 piezas eléctricas

Las fuentes son: contexto §2, `la_pluma.py` y el plan §10–§14. El conteo completo está en `.out` §1.

| bloque | piezas | qué incluye |
|---|---|---|
| potencia | 29 | LRS, F1 (2), Ce (2), Cf, Q1, D1, choque de 41 µH, Hall, Cout de 10 µF, sangrado, **Q3**, snubber (2), TVS, disipador + 3 micas, P1–P8, pinza |
| manejo | 14 | IR2110, bootstrap (4, con zener), compuerta de Q1 (5: Rg_on, Rg_off + diodo, Rgs, zener), compuerta de Q3 (2), desacoplo (2) |
| medición | 13 | Pico 2, divisor de V_salida (3), divisor de V_bus (3), NTC (2), adaptación del Hall (3), riel de 5 V |
| auxiliar | 7 | DC-DC 48→12, ventilador, driver del motor, GX12 (2), PARO, zumbador |

### 4.2 Pieza por pieza

| pieza | ¿se va o se funde? | número que lo decide | veredicto |
|---|---|---|---|
| **choque 41 µH** | No se va. Se achica a 15 µH (18 vueltas) | Los cables dan 2.2–3.5 µH y las barras 0.064 µH: a 100 kHz serían 34–1873 A pp. Hacen falta ≥ 12 µH para 10 A pp. Con 15 µH: 17.7 W contra 35.6 W, y 12 contra 33 mJ | quitarlo: **FALSA**; achicarlo: **PASA** |
| **Hall ACS758 → shunt 0.5 mΩ + INA240** | Se cambia | Mismo número de piezas, pero se va el riel de 5 V y el divisor. Ruido de hoja de datos: 0.25–0.38 App en el Hall contra un offset de 50 mA en el INA240. Fase a 10 kHz: 8.4° contra 1.4°, aunque el filtro del firmware (21.8°) domina. En la simulación la onda de 668 Hz sale igual (30.7 contra 30.6 A) | **PASA** (cambio, no ahorro) |
| **observador volt-segundo en vez de sensor** | No | Error en régimen = ΔV/R_lazo con R_lazo = 33 mΩ: Vf de D1 caliente → 2.7 A, borde de PWM de 20 ns → 2.9 A, Rds caliente → 7.9 A | **FALSA** como medida absoluta; sirve para predecir dentro de un periodo |
| **Q3 atajo** | Se va del modo arco | Corto con «baja a 10 A» sin Q3: 9.6 A en la ruptura (con Q3 en `la_pluma` D eran 14.2 A). En modo arco Q3 estorba: apaga justo el arco que se busca | **PASA** en arco; **INCIERTO** si vuelve el modo contacto. Queda el canal LO libre del IR2110 para regresarlo sin rediseñar |
| **IR2110** | Se queda | El buck del lado bajo no lo necesita, pero ver §4.4.f: la mesa queda a +47.6 V y la antorcha a +22.8 V contra la tierra del USB, V_arco se vuelve diferencial (1.7 V rms de error crudo contra 0.44 V en un canal) y P_Q1 sube de 39 a 48 W | topología sin IR2110: **FALSA** para este banco |
| **TVS** | Se va | Con un lazo de 15 nH: Vds de 78 V, contra 200 V del FET | **PASA** si el lazo ≤ 20 nH (con 60 nH: 120 V, margen flaco) |
| **snubber RC + Rg_off/diodo** | Se funden en UNA Rg de 22 Ω | Con Rg 10 sin snubber D1 llega a 100.2 V (avalancha). Con Rg 10 + snubber: D1 61.7 V. Con Rg 22 sola: D1 63.0 V y Vds 78.5 V, a cambio de +5 W en Q1 (39.2 contra 34.1 W) | **PASA**: 5 piezas → 1 |
| **zeners de bootstrap y de compuerta** | Se van | VBS 12.0 V; VS contra el ánodo de D1 −0.81 V. Con lazo de 60 nH, VBS sube a 17.6 V | **PASA** con COM del IR2110 en el ánodo de D1 y lazo ≤ 30 nH |
| **Cout 10 µF + 1 k** | → 1 µF + D2 (salida→bus); el sangrado se funde con el divisor de 16 k | Con barras cortas, 10 µF resuena con ~0.15 µH cerca de 100 kHz: 13.8 A pp en el arco, contra 9.7 A pp con 1 µF. Al perforar el fundente con 30 V se vacía: 4.55 mJ y 210 A con 10 µF, contra 0.46 mJ y 74 A con 1 µF | **PASA** |
| **DC-DC 48→12** | Se queda; es el único riel auxiliar | Alimenta el IR2110, el motor (~0.4 A rodando; 9.9 A de pico en la retracción, o 3.6 A con el límite del DRV8871) y el ventilador | se queda |
| **NTC de D1** | → termostato KSD301 NC en serie con SD | No hay 4.º ADC (GP29 = VSYS/3). Además, el termostato corta en hardware, sin depender del firmware | **PASA** |
| **divisor de V_bus** | Se funde | La LRS con +RS/−RS regula en los capacitores (±0.5 % de carga, hoja de datos). La alimentación anticipada usa 48 V fijos: la simulación MIN corre así y da 40.00 A. V_bus se mide en reposo por V_salida con Q1 encendido | **PASA** |
| **sensores del motor** | Sin encoder: fcem | Abrir el puente 0.5 ms: la terminal marca K·ω y la velocidad cae 0.22 %. Paso de ADC = 0.58 mm/s de alambre (1.15 % a 3 m/min). El imán de ferrita deriva ~−0.2 %/K: hay que calibrar con 1 m de alambre | **PASA** (modelo supuesto) |
| **ventilador** | Se queda | En modo contacto la LRS va al ~8 % de carga (94 W en `la_pluma.out`) y su ventilador inteligente casi no gira, mientras Q1 + D1 disipan ~34 W. En arco disipan 52 W | quitarlo: **INCIERTO** |
| **PARO, fusible** | Se quedan | Un Q1 en corto solo se detiene cortando la LRS. El control remoto RC de la LRS no es a prueba de fallas (necesita voltaje externo para apagar), así que el PARO corta la fase de AC | se quedan |
| **GX12, zumbador, pinza, cables de 2 m** | Se van | El alimentador va en la misma base (bornera). La mesa es el contacto | **PASA** |

### 4.3 El circuito mínimo

```
               F1                      (Q1, D1, Cf en el MISMO disipador: lazo <= 15-20 nH; Ce a <= 30 nH)
 LRS +V/+RS ─o~o─┬─[Ce 2200µ]x2─┬─[Cf 4.7µ]x2─┬─ D  Q1 IRFB4227  S ─┬─ SW ── L1 15 µH (18 v. cal 10, 11 mΩ) ──┬── SALIDA ══ barra ══► MESA (+, pieza)
                 │              │             │   G ─ 22 Ω ─ HO      │                                        ├── Cout 1 µF película
                 │              │             │   10 k G–S          K│                                        ├── D2 (A = salida, K = +48 bus)
                 │              │             │                  D1 MBR40100CT                                └── 15 k / 1 k ─► GP27 (V_salida; es el sangrado)
 LRS −V/−RS ─────┴──────────────┴─────────────┴────────── ★ ◄───── A (COM del IR2110 AQUÍ: Kelvin al ánodo de D1)
                                                         ★ ── shunt 0.5 mΩ ── barra ══► BLOQUE DEL ALIMENTADOR (alambre −, DCEN)
                                                                  └─ INA240A2 (3.3 V, REF a ★) ─► GP26
 IR2110: VCC 12 V (DC-DC), VDD 3.3 V (Pico), VSS ★; HIN ◄ GP16 (PWM 100 kHz)
         SD = pull-up 10 k a VDD, jalado a ★ por la serie [PARO NC] + [KSD301 80 °C NC] + [GP14 colector abierto] → cualquier corte = SD alto = Q1 apagado
 bootstrap: 12 V ─ 4.7 Ω ─ Dbs ─ VB ; Cbs 1 µF entre VB y SW. LO del IR2110 libre (reserva para Q3)
 motor: 12 V ─ puente H (DRV8871: IN1/IN2 ◄ GP18/GP19, PWM 20 kHz) ─ motor SOMI ; terminal B ─ 47 k/10 k ─► GP28 ; terminal A ─ 10 k a ★
 PARO de 2 contactos NC: (1) fase de 220 V de la LRS ; (2) lazo SD
```

Con polaridad DCEN la pieza va al «+» y el alambre a ★, de modo que el alimentador, el rodillo y el puente H comparten tierra y no hay que aislarlos entre sí. Si el carrete pide DCEP, se cruzan las dos barras y el shunt sigue en la pata de ★.

### 4.4 Telemetría ngspice

**a) Regulación.** Arco de 1 mm. Escalón de 20 a 40 A en 1.0 ms; régimen medido en 2.6–3.4 ms.

| caso | I | IL pp | I_arco pp | t10–90 | sobrepaso | asienta | Vds | VD1 | VS–D1 | VBS | Cf rms | Ce rms | P_Q1 | P_D1 | P_L | pérdidas | η |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| BASE20 | 39.98 | 13.8 | 15.3 | 307 µs | 0.0 | 423 µs | 75.6 | 66.1 | −0.79 | 12.15 | 14.1 | 7.9 | 29.4 | 12.9 | 35.6 | 103.6 W | 90.5 % |
| BASE100 | 39.98 | 2.8 | 2.4 | 68 | 4.4 | 208 | 75.4 | 77.8 | −0.78 | 12.51 | 28.1 | 10.1 | 39.3 | 12.6 | 35.2 | 124.1 | 88.9 |
| **MIN** | **40.00** | **7.6** | **9.7** | **23** | **8.2** | **119** | **78.5** | **63.0** | **−0.81** | **12.00** | **15.5** | **7.2** | **39.2** | **13.1** | **17.7** | **92.5** | **91.5** |
| MIN Rg 10 sin snubber | 40.00 | 7.9 | 9.7 | 24 | 8.4 | 122 | 93.2 | **100.2** | −0.81 | 11.99 | 15.3 | 7.2 | 34.1 | 13.1 | 17.7 | 87.5 | 91.9 |
| MIN Rg 10 + snubber | 40.00 | 7.7 | 9.7 | 24 | 8.4 | 122 | 88.5 | 61.7 | −0.80 | 11.99 | 15.4 | 7.2 | 33.0 | 13.1 | 17.7 | 88.1 | 91.8 |
| MIN, Ce a 150 nH | 40.00 | 7.6 | 9.7 | 26 | 8.3 | 128 | 78.9 | 84.1 | −0.81 | 12.00 | **26.3** | 9.8 | 38.5 | 13.0 | 17.7 | 99.0 | 90.9 |
| MIN, lazo 30 nH | 40.00 | 7.8 | 9.7 | 23 | 8.2 | 120 | 94.5 | **98.9** | −0.81 | 12.73 | 15.5 | 7.2 | 40.1 | 13.0 | 17.7 | 93.7 | 91.4 |
| MIN, lazo 60 nH | 40.00 | 7.8 | 9.7 | 23 | 8.1 | 121 | 119.7 | **100.4** | −0.81 | 17.56 | 15.6 | 7.2 | 42.0 | 13.0 | 17.7 | 95.8 | 91.2 |
| MIN con 41 µH | 40.00 | 2.9 | 3.7 | 65 | 5.0 | 177 | 76.8 | 64.0 | −0.78 | 11.99 | 16.1 | 7.2 | 38.9 | 12.8 | 35.2 | 110.1 | 90.0 |
| MIN, Cout 10 µF sin D2 | 40.00 | 7.6 | **13.8** | 23 | 8.3 | 118 | 78.3 | 62.9 | −0.81 | 12.00 | 15.5 | 7.2 | 39.2 | 13.1 | 17.7 | 92.6 | 91.5 |
| MIN con Hall | 40.00 | 7.6 | 9.7 | 23 | 5.5 | 156 | 77.0 | 63.2 | −0.80 | 11.98 | 15.5 | 7.2 | 39.1 | 13.1 | 17.7 | 92.5 | 91.5 |

Unidades: A, µs y V; en la fila de BASE20 van escritas.

Cómo leer la tabla:

- **VS–D1** es el pin VS medido contra el ánodo de D1.
- Medido contra la estrella, el nodo SW baja a −12…−34 V: es la caída de la inductancia del lazo. Por eso **COM va Kelvin al ánodo de D1**. El IR2110 tolera ±5 V entre VSS y COM, y la lógica funciona con VS hasta −4 V (hoja de datos).
- La columna «bus pp» del `.out` incluye las agujas de conmutación; no es rizo de baja frecuencia.

**b) Onda de 40 + 30 A a 668 Hz** (canal l=2), 100 kHz, MIN.

| sensor | DC | onda | retraso | rizo95 | Vds máx | **VD1 máx** |
|---|---|---|---|---|---|---|
| shunt + INA240 | 39.7 A | 30.7 A | −2.0° | ±4.9 A | 89.1 V | **93.9 V** |
| Hall | 39.7 A | 30.6 A | −0.95° | ±4.9 A | 87.9 V | **93.9 V** |

- Referencia del canon con 41 µH: 30.7 A y −1.7° a 100 kHz; 26.2 A y 31.8° a 20 kHz.
- **El sensor no limita la onda de la gota:** el Hall no estorba al control; lo que se gana al cambiarlo son rieles y offset.
- **Con picos de 70 A, D1 llega a 94 V**, contra 63 V a 40 A fijos, y su ruptura es de 100 V. Para el campanazo hay dos salidas:
  - cambiar D1 por un Schottky de 150–200 V en el mismo TO-220 (no cambia el conteo);
  - regresar el snubber RC.

**c) Arranque.** OCV de 30 V; toque con película de fundente de 30 Ω, que se perfora a los 100 µs; separación con cuello de 20 → 50 mΩ; rampa a 40 A.

| medida | retracción (15 A al separar) | clásico (40 A desde el toque) | retracción con Cout 10 µF sin D2 |
|---|---|---|---|
| Cout al perforar el fundente: ½CV² | 0.46 mJ | 0.46 mJ | 4.55 mJ |
| pico al perforar | 74 A | 74 A | 210 A |
| **I en la ruptura** | **14.5 A** | **38.9 A** | 14.6 A |
| **energía en el cuello, últimos 50 µs** | **0.45 mJ** | **3.16 mJ** | 0.45 mJ |
| ¿prende el arco? | sí (pico de 14.7 V) | sí (15.4 V) | sí |
| energía al arco en el 1.er ms | 253 mJ | 692 mJ | 254 mJ |
| Vds / VD1 | 76.8 / 62.9 V | 76.4 / 63.8 V | 76.8 / 63.1 V |

Traza cruda de la separación con retracción (`.out` §3.3):

```
1.6500 ms  I = 14.4 A  V = 0.72  R = 50 mΩ
1.6667 ms  abierto, arco 16.2 A a 14.4 V  (duty 0.36)
```

**d) Corto durante el arco** y **e) apagado**: tablas en §4.8.

**f) Buck del lado bajo (sin IR2110).** 40 A en arco de 1 mm.

| magnitud | valor |
|---|---|
| Vds | 58 V |
| inversa en D1 | 48 V |
| rebote de la fuente de Q1 | −4.1 / +4.8 V |
| P_Q1 | **48.0 W** (MIN: 39.2): la inductancia de fuente común frena la conmutación |
| P_D1 | 12.9 W |
| pieza (mesa) contra la tierra del USB | **+47.6 V**, permanentes |
| antorcha y alimentador | **+22.8 V** |
| V_arco = V_pieza − V_antorcha, dos canales del ADC a 2 µs | error crudo de **1.7 V rms** (3.6 V de pico); el nodo de la pieza trae 1.33 V rms del rizo del bus |
| MIN, un solo canal | 0.44 V rms |

Ahorra 5 piezas pequeñas, pero tiene tres problemas:

- pone la mesa a 48 V de tierra (si la base toca tierra, el bus se cortocircuita por el USB);
- vuelve diferencial el oído;
- calienta más a Q1.

### 4.5 El motor del alimentador (mismo Pico, PWM + puente H)

**PWM con un solo MOSFET solo avanza.** Para retraer hace falta un puente H: un DRV8871 de 6.5–45 V y 3.6 A pico, con límite de corriente interno y entradas IN1/IN2. Si el motor medido pasa de ~3 A rodando, va un BTS7960 (de memoria: 5.5–27 V, 43 A, sin verificar).

Con el modelo SUPUESTO (`.out` §4):

- **Avance:**
  - en vacío daría 12.9 m/min;
  - 3 m/min piden 3.24 V (duty de 0.27);
  - un escalón llega al 90 % en 48.9 ms: τ_m = 21.8 ms, es decir, **~7 Hz de ancho de banda**.
- **Retracción:**
  - con reversa a −12 V y freno pasivo, el rodillo se pasa hasta ~−3.9 mm;
  - **hace falta un lazo de posición PD sobre la posición integrada por fcem** (Kp = 40 000 V/m, Kd = 240 V/(m/s)). Así llega a −1.5 ± 0.05 mm en **25 ms** con 0.06 mm de sobrepaso; el rodillo sigue avanzando 0.025 mm después del toque, y el pico es de 9.9 A (puente sin límite, tipo BTS7960);
  - con el límite de 3.6 A del DRV8871 (decaimiento lento) tarda **37 ms** y se pasa hasta −1.83 mm, porque también el frenado queda limitado. Si el motor real pide más de ~3 A, va el BTS7960;
  - holgura del forro, SUPUESTA (forro de 1.5 mm, alambre de 0.8): juego = 0.7 mm × el ángulo total de las curvas. Para levantar la PUNTA 1.0 mm:

    | antorcha | juego | el rodillo recoge | tiempo |
    |---|---|---|---|
    | recortada a 0.4 m, casi recta | 0.35 mm | 1.35 mm | 24 ms |
    | 2 m en U | 2.55 mm | 3.55 mm | 39 ms |
    | 2 m con una vuelta | 4.75 mm | 5.75 mm | 51 ms |

  - El juego además es incierto: cambia con cómo quede tendida la antorcha. **Conclusión: si se usa retracción, la antorcha se acorta.**
- **Fcem sin encoder:**
  - se abre el puente 0.5 ms cada ~20 ms;
  - la corriente de 0.37 A se descarga por los diodos en 20 µs;
  - a los 0.3 ms la terminal marca 2.794 V = K·ω exacto;
  - la velocidad cae 0.22 %;
  - resolución: 0.58 mm/s por muestra (1.15 % a 3 m/min).
- **Sincronía con las gotas:**
  - gotas/s = v_f·πr_w²/(4/3·πa³). A 3 m/min y a = 0.4526 mm salen **64.7 gotas/s** (0.77 mm de alambre por gota). El canon reporta 75/s en su modelo; por balance de masa puro salen 65.
  - **El motor (7 Hz) NO puede ir gota a gota (65 Hz): FALSA.**
  - Lo que sí gana:
    1. el arco pone el reloj de la gota, y el disparo se programa con la v_f medida (V_gota = v_f·A/f_disparo);
    2. la ley I ∝ √v_f del operador queda automática;
    3. **cuenta de masa:** el volumen alimentado (∫fcem) contra las gotas contadas por el oído × V_gota. Si no coinciden, hay salpicadura o gotas perdidas. Es «acuerdo o silencio» con dos sensores independientes;
    4. toque mecánico: cuando el alambre topa, la fcem cae y la corriente del motor sube, y eso confirma el toque eléctrico;
    5. quemado final (burn-back): se para el motor, se sostiene el arco ~20–40 ms (a 3 m/min el alambre funde 1 mm cada 20 ms) y se retrae 0.5 mm. El alambre no queda pegado y el stickout queda igual para el siguiente arranque.

### 4.6 La base: barras cortas, contacto en la mesa

Vista de arriba (mm). Base de triplay de 18 mm, de 700 × 300, sobre patas de 65 mm. El origen está en el arco.

```
 y=+150 ┌────────────────────────────────────────────────────────────────────────────────────────────┐
        │  ALIMENTADOR SOMI            MESA                                   TORRE                  │
        │  sobre bloque de PE/G10 20   azulejo 150x150 en marco impreso       LRS 230x124x41 + caja  │
        │  4xM8 con bujes de nylon     placa 100x50x3 entre 2 mordazas        (Q1-D1-Cf-Ce en un    │
        │  (vive a ★: alambre −)       de latón 60x15x5 en x=±50, M8          disipador, choque     │
        │  x = −300                    ● arco en (0,0)                        >= 25 cm del arco)    │
   y=0  │  [rodillo]═antorcha 0.4 m══╗      ●                                 x = +300              │
        │   mango horizontal a z=+60 ╝                                                             │
 y=−150 │ ═════ retorno ★: alimentador → caja, por el borde trasero (z = −45), NUNCA bajo el arco ═══ │
        └────────────────────────────────────────────────────────────────────────────────────────────┘
       x=−350                                     x=0                                           x=+350
```

Corte en x = 0, de abajo arriba:

```
 z = −60          barra de ida (solera 25.4 x 3.2), de la caja (+x) al poste central
 z = −60 → −30    poste M8 en x = 0, sobre el eje: no hace campo en el arco
 z = −30          barra partida bajo la mesa, de mordaza (−60) a mordaza (+60), alimentada al centro
 z = −29 → −11    base
 z = −11 → −3     azulejo
 z = 0            placa (pieza, +)
 z = +1           punta del alambre (arco de 1 mm)
 z = +16          punta de contacto
 z = +60          el mango sale horizontal hacia −x
```

Regla de trazado (Biot–Savart). La corriente que **llega** por abajo debe venir del lado **opuesto** al que **se va** la antorcha por arriba, y a la misma distancia del arco. Así, sus campos en el arco se restan (simetría de punto).

| trazado | \|B\| a 1 mm, arco al centro | arco a 25 mm del centro |
|---|---|---|
| A · pinza en un extremo + cable | 0.192 mT | 0.221 mT |
| B · barra integrada en un extremo | 0.170 | 0.122 |
| C · dos mordazas simétricas, barra partida a −60 | 0.058 | 0.088 |
| E · C con la alimentación a −150 | 0.058 | 0.059 |
| **F · mango a +60, alimentación a −60** | **0.058** | **0.062** |

- **La mesa integrada baja el campo 3.3×** (0.19 → 0.06 mT) y lo vuelve casi independiente de dónde cae el arco.
- **Los dos campos son chicos** frente a la patada de apuntar de 3 mT. El dato del plan §11 («0.8 mT a 1 cm») vale para un conductor a 1 cm, no para una pinza a 5 cm. Si 0.2 mT mueve el arco lo decide el agente 09.
- **Lo que sí importa es el lazo:**

| trazado | inductancia | energía a 40 A |
|---|---|---|
| cables de 2 m separados 10 cm (hoy) | 3.49 µH | 2.8 mJ |
| antorcha SOMI de 2 m tendida sobre la barra | 0.74 µH | 0.6 mJ |
| antorcha recortada a 0.4 m | 0.15 µH | 0.12 mJ |
| barras laminadas de 0.35 m | 0.064 µH | 0.05 mJ |

  Esa energía queda **afuera** de D2 y se descarga en el hueco en cada ruptura.
- El choque de 18 vueltas a 25 cm da 0.026 mT en su eje: va dentro de la torre.

### 4.7 Canales: cada pieza que queda tiene uno

**Actuadores**

| actuador | qué mueve | banda |
|---|---|---|
| Q1 (PWM 100 kHz) | la corriente | 0–10 kHz: l=0 calor/volumen y l=2 soltar la gota |
| puente H del motor | el alambre | 0–7 Hz: volumen, retracción y quemado final |

Cada uno en su banda, separados ~1000×: es la «escalera de tiempos» del 31 de octubre.

**Sensores (3 ADC = 3 canales)**

| pin | señal | qué lee |
|---|---|---|
| GP26 | corriente | energía y onda |
| GP27 | V_salida | gap a 10 V/mm, el oído l=2, toque y corto (V < 8 V), y V_bus en reposo |
| GP28 | fcem | velocidad y posición del alambre, toque mecánico |

**Seguridad en hardware, sin canal de firmware:** PARO, termostato y fusible.

**Sin canal en arco:** Q3. Por eso se va.

### 4.8 Corto y apagado (detalle de §4.4 d y e)

**d) Corto durante el arco.** Arco de 1 mm a 40 A. Una gota toca a 0.8 ms (10 mΩ); el cuello va de 10 a 50 mΩ entre 1.6 y 1.9 ms; el puente abre a 1.9 ms.

| medida | CC 40 A | **baja a 10 A** (V < 8 V) | baja a 10 A con 41 µH |
|---|---|---|---|
| pico al tocar (Cout 1 µF + barra) | 96.9 A | 96.9 A | 99.3 A |
| I 200 µs después de tocar | 39.2 A | **26.3 A** | 32.7 A |
| **I en la ruptura** | 39.0 A | **9.6 A** | 8.6 A |
| energía en el puente (0.8–1.9 ms) | 25.9 mJ | 4.6 mJ | 6.6 mJ |
| **energía del cuello, últimos 50 µs** | 3.68 mJ | **0.23 mJ** (16× menos) | 0.14 mJ |
| ¿reenciende? | sí, a 17.5 V | sí, a 16.7 V | sí, a 16.7 V |
| vuelve a 40 ± 2 A | 25 µs | 351 µs (rampa) | 350 µs |
| Vds / VD1 | 76.6 / 63.7 V | 79.7 / 63.6 V | 76.8 / 64.5 V |

Traza cruda del caso «baja a 10 A»:

```
0.82 ms  44 A
0.90 ms  36 A
1.02 ms  25 A
1.10 ms  19 A   (con 0.2 V en el puente)
1.87 ms  10.1 A, cuello de 44.7 mΩ
1.933 ms abierto: arco de 11.5 A a 16.5 V; rampa hasta 40 A en 2.27 ms
```

**El corto dura lo bastante para que la bobina descargue sola**, sin Q3. La pendiente al caer es de −0.1 a −0.03 A/µs. Si solo hubiera 200 µs de aviso (el cuello del `la_pluma`), el choque de 15 µH llegaría a 26 A y el de 41 µH a 33 A: **el choque chico es parte del control.**

**e) Apagado.** Arco de 1 mm a 40 A.

| medida | PARO (SD) | **arco que se apaga** (gap → 10 mm), con D2 | igual, Cout 10 µF sin D2 | BASE20 (41 µH, 10 µF, cable 0.5 µH) |
|---|---|---|---|---|
| KILL después de | 0.1 µs | 7.0 µs (V > 40 V) | 9.2 µs | 19.7 µs (a 39.3 A) |
| bobina < 1 A en | 21 µs | **17.7 µs** | 16.6 µs | 31.2 µs |
| energía al arco después | 9.7 mJ (el arco absorbe la bobina) | 0.86 mJ | 0.51 mJ | 0.98 mJ |
| **V_salida máximo** | 25.0 V | **53.0 V** | 72.0 V | **103.2 V** |
| V en la pluma (con la barra) | 50.4 V | 56.7 V | 72.0 V | 103.2 V |
| I por D2 | 1.5 A | 46.6 A durante ~18 µs | — | — |

- **D2 mantiene la salida por debajo de los 60 V de SELV** y devuelve la energía de la bobina al bus. Sin D2 serían 72 V con 10 µF, o ~155 V con 1 µF (√(V0² + L·I²/C)). **La Pluma de hoy (BASE20) pone 103 V en la antorcha** cuando el arco se apaga a 39 A: su TVS está en Q1, no en la salida.
- Después de KILL, la salida queda a ~47 V. Se descarga por el divisor de 16 k en τ = 16 ms. El firmware no debe volver a tocar en ese intervalo, porque el toque vaciaría 1.1 mJ.
- D2 aguanta 46.6 A por ~18 µs. Un 1N5408 lo soporta (200 A de sobrecorriente, de memoria); mejor un UF5408 (rápido).

## 5. Veredictos

1. **Quitar el choque y usar la inductancia de cables o barras: FALSA.** Daría 34–1873 A pp a 100 kHz. Lo decide medir el rizo con el shunt.
2. **Achicar el choque a 15 µH (18 vueltas): PASA.** Lo decide la pérdida en la bobina, medida por ΔT (predicción: 17.7 W contra 35.6 W), y el escalón de 23 µs.
3. **Hall → shunt + INA240: PASA como cambio** (sin pérdida de control; ahorra el riel de 5 V). Lo decide comparar contra un amperímetro de gancho a 40 A: error ≤ 0.5 A.
4. **Observador volt-segundo en lugar de sensor: FALSA** (2.7–7.9 A de error). **PASA** como predictor dentro del periodo.
5. **Quitar Q3 en modo arco: PASA** (9.6 A en la ruptura bajando la referencia en el corto, contra 39). **INCIERTO** para modo contacto.
6. **Topología sin IR2110 (lado bajo): FALSA para este banco** (mesa a 48 V, V_arco diferencial con 1.7 V rms, P_Q1 +9 W).
7. **Quitar TVS + snubber + zeners con una sola Rg de 22 Ω: PASA si lazo ≤ 15–20 nH y Ce ≤ 30 nH. INCIERTO** hasta medir el lazo real: con 30 nH D1 llega a 98.9 V.
8. **Cout 1 µF + D2 en lugar de 10 µF: PASA:**
   - al perforar: 0.46 mJ contra 4.55 mJ;
   - rizo en el arco: 9.7 contra 13.8 A pp;
   - arco que se apaga a 40 A: la salida llega a 53 V (72 V sin D2; La Pluma de hoy, 103 V).
9. **Arranque con retracción: PASA en lo eléctrico** (14.5 contra 38.9 A en la ruptura; 7× menos energía en el cuello). **INCIERTO en lo mecánico** hasta medir el motor y el forro.
10. **Avance sincronizado gota a gota con el motor: FALSA** (7 Hz contra 65 gotas/s). **PASA** en promedio y como cuenta de masa.
11. **Velocidad del alambre por fcem sin encoder: PASA en el modelo, INCIERTO en el banco** (el motor SOMI no está medido).
12. **Mesa integrada y barras: PASA** para la inductancia del lazo (3.49 → 0.06–0.15 µH) y para el campo (0.19 → 0.06 mT). **INCIERTO** si 0.2 mT importaba.

## 6. Qué cambia (concreto)

**Quitar:**

- Q3 y Rg3/Rgs3;
- el TVS;
- el snubber de 3.3 Ω/10 nF;
- el zener de bootstrap y el de compuerta;
- Rg_off de 33 Ω y su diodo;
- el ACS758, su divisor y su riel de 5 V;
- la NTC;
- el divisor de V_bus;
- el sangrado de 1 k;
- los GX12;
- el zumbador;
- la pinza de tierra;
- los cables P3/P4 de 2 m.

**Agregar:**

- shunt de 0.5 mΩ + INA240A2 en la pata de ★;
- D2 de salida a +48;
- Cout de 1 µF;
- un segundo Cf de 4.7 µF (llevan ~15 A rms juntos);
- KSD301 NC de 80 °C en el lazo SD + pull-up de 10 k;
- puente H DRV8871 + divisor de la terminal B y pull-down en A;
- una sola Rg de 22 Ω.

**Cambiar:**

- el choque, de 40 a 18 vueltas (desenrollar 22);
- la conmutación, de 20 kHz a 100 kHz;
- los electrolíticos, al disipador;
- COM del IR2110, al ánodo de D1;
- +RS/−RS de la LRS, a los capacitores;
- el PARO, para que corte la fase de 220 V y el lazo SD;
- la antorcha, recortada a ~0.4 m si se usa retracción.

**Firmware:**

- PI de corriente a 100 kHz con alimentación anticipada a 48 V fijos;
- V_bus calibrado en reposo;
- corto (V < 8 V) → referencia a 10 A hasta V > 13 V, y luego rampa de 0.375 ms;
- arranque: OCV de 30 V → toque (I > 0.5 A o fcem cae) → 15 A → retracción por PD hasta 1.0 mm + juego → rampa a la corriente de trabajo → avance;
- ventana de fcem de 0.5 ms cada 20 ms;
- quemado final de 30 ms y retracción de 0.5 mm;
- tope de gap a 40 A ≈ 1.4 mm (límite del 105 % de la LRS);
- cuenta de masa por evento.

**Antes de armar:**

- confirmar que la línea es de 220 V;
- medir el motor (§7, experimento 2).

## 7. El experimento más barato que lo decide

**Experimento 1: la etapa mínima contra una carga falsa, sin arco** (~1 h, decide los veredictos 2, 3, 7 y 8).

Montaje:

- carga de 0.6 Ω a 40 A, ~1 kW: espiral de solera de acero inoxidable o alambre de nicromo dentro de una cubeta de agua;
- osciloscopio con punta de tierra corta (resorte);
- amperímetro de gancho.

Se mide:

- Vds de Q1;
- inversa de D1;
- VS contra el ánodo de D1;
- VBS;
- rizo con el INA240;
- temperatura de Q1, D1 y la bobina a los 2 min.

| medición | predicción si el lazo es de ~15 nH (MIN) | si falla |
|---|---|---|
| Vds pico | ≤ 80 V | > 95 V → lazo ≥ 30 nH |
| D1 inversa | ~63 V | ≥ 90 V → lazo ≥ 30 nH: regresa el snubber RC (61.7 V) o D1 de 200 V |
| VS–ánodo D1 | ≥ −1 V | |
| VBS | 12.0 ± 0.3 V | |
| rizo | 7.6 A pp | |
| INA240 contra el gancho | dentro de 0.5 A | |
| pérdidas Q1 + D1 + L | ~70 W (39 + 13 + 18) | |

**Experimento 2: el motor de la SOMI** (10 min, sin potencia; decide los veredictos 9–11):

1. R con multímetro.
2. A 12 V, sin alambre: corriente en vacío y vueltas del rodillo por segundo (video) → K = (V − I·R)/ω.
3. Tiempo en detenerse al soltar (video).
4. Marcar el alambre en la punta y girar el rodillo hacia atrás a mano: cuánto gira el rodillo antes de que la punta se mueva = juego del forro.

| magnitud | predicción del modelo | si sale así… |
|---|---|---|
| K | ~0.02 V·s/rad | |
| τ_m | ~20 ms | > 60 ms → la retracción tarda > 100 ms: se arranca con toque suave y corriente baja, y el motor queda solo para volumen |
| juego | ≈ 0.7 mm × radianes de curva (0.35 mm recortada, 2.5–4.8 mm con 2 m) | > 3 mm → recortar la antorcha |

## 8. Fuentes

- Mean Well LRS-1200 (entrada 180–305 Vac; 48 V/25 A; pico de 37.5 A por 5 s; sobrecarga > 105 % por 5 s → apagado; control remoto RC; remote sense de 0.3 V): https://www.meanwell.com/Upload/PDF/LRS-1200/LRS-1200-SPEC.PDF
- Allegro ACS758 (respuesta de 4 µs = 1 µs + 3 µs; 120 kHz; 20 mV/A en el -100B; ruido de 10.03 mVpp en el -050B y 3.84 mVpp en el -200B): https://www.allegromicro.com/~/media/files/datasheets/acs758-datasheet.pdf · FAQ: https://www.allegromicro.com/en/products/sense/current-sensor-ics/integrated-current-sensors/acs758/acs758-faq
- TI INA240 (−4 a 80 V de modo común, 400 kHz, ganancias de 20/50/100/200, offset de 25 µV, error de 0.2 %): https://www.ti.com/product/INA240
- IR2110 (lógica operativa con VS hasta −4 V; ±5 V entre VSS y COM; dVs/dt de 50 V/ns): https://www.rcscomponents.kiev.ua/datasheets/IR2110.pdf (copia de terceros)
- TI DRV8871 (6.5–45 V, 3.6 A pico, regulación de corriente sin shunt, IN1/IN2 con modos de rueda libre y freno): https://www.ti.com/lit/gpn/drv8871
- Pico 2: GP29 = ADC3 = VSYS/3, GP24 = sensado de VBUS: https://nuttx.apache.org/docs/latest/platforms/arm/rp23xx/boards/raspberrypi-pico-2/index.html · https://docs.sunfounder.com/projects/newton-lab-kit/en/latest/raspberry_pi_pico2.html
- ENOB del ADC del RP2350 (~9, discutido): https://github.com/earlephilhower/arduino-pico/discussions/2763
- Fronius CMT/SFI (el alambre se retrae al tocar; encendido sin salpicadura): https://www.fronius.com/en/welding-technology/world-of-welding/fronius-welding-processes/cmt · https://www.fronius.com/-/media/microsites/sus-23---products/downloads/pw_bro_cmt_en.pdf
- **De memoria, sin verificar:**
  - la fórmula de Wheeler;
  - el BTS7960 (5.5–27 V, 43 A);
  - el KSD301;
  - el ID del forro de 1.5 mm para alambre de 0.8;
  - la deriva de −0.2 %/K de la ferrita.
- **Modelos SPICE:** el IRFB4227 y el MBR40100CT son los de `scripts/la-pluma/la_pluma.py`, no se volvieron a verificar contra sus hojas de datos.
